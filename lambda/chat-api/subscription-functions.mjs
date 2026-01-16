// ==================== 구독 관리 함수 ====================
// 이 파일의 내용을 index.mjs 끝에 추가해주세요

// 사용자 구독 티어 변경
async function updateSubscriptionTier(event, headers) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { adminUserId, targetUserId, newTier } = body;

    console.log('Updating subscription tier:', { adminUserId, targetUserId, newTier });

    // 관리자 권한 확인
    const adminUser = await dynamoClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId: adminUserId }
    }));

    if (!adminUser.Item || adminUser.Item.role !== 'ADMIN') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'FORBIDDEN', message: 'Admin access required' })
      };
    }

    // 유효한 티어인지 확인
    const validTiers = ['FREE', 'TRIAL', 'PREMIUM', 'UNLIMITED'];
    if (!validTiers.includes(newTier)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'VALIDATION_ERROR', message: `Invalid tier: ${newTier}` })
      };
    }

    // 대상 사용자 조회
    const targetUser = await dynamoClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId: targetUserId }
    }));

    if (!targetUser.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'NOT_FOUND', message: 'User not found' })
      };
    }

    const oldTier = targetUser.Item.subscriptionTier || 'UNLIMITED';

    // 티어별 할당량 설정
    const tierLimits = {
      'FREE': 50,
      'TRIAL': 1000,
      'PREMIUM': 1500,
      'UNLIMITED': -1
    };

    const today = new Date().toISOString().split('T')[0];
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const firstDayNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1)
      .toISOString().split('T')[0];

    // 구독 티어 업데이트
    const updateExpression = [
      'subscriptionTier = :tier',
      'messageQuota.monthlyLimit = :limit',
      'messageQuota.currentMonthUsage = :zero',
      'messageQuota.lastResetDate = :today',
      'messageQuota.nextResetDate = :nextMonth'
    ];

    const expressionValues = {
      ':tier': newTier,
      ':limit': tierLimits[newTier],
      ':zero': 0,
      ':today': today,
      ':nextMonth': firstDayNextMonth
    };

    // TRIAL 티어인 경우 체험 기간 설정
    if (newTier === 'TRIAL') {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 30);

      updateExpression.push('trialPeriod = :trialPeriod');
      expressionValues[':trialPeriod'] = {
        startDate: new Date().toISOString(),
        endDate: trialEnd.toISOString(),
        isExpired: false,
        daysRemaining: 30
      };
    } else {
      // TRIAL이 아니면 체험 기간 제거
      updateExpression.push('trialPeriod = :null');
      expressionValues[':null'] = null;
    }

    // 메타데이터 업데이트
    updateExpression.push('subscriptionMetadata = :metadata');
    expressionValues[':metadata'] = {
      upgradedAt: new Date().toISOString(),
      upgradedFrom: oldTier,
      autoRenew: true,
      billingCycle: newTier === 'UNLIMITED' || newTier === 'PREMIUM' ? 'lifetime' : 'monthly'
    };

    await dynamoClient.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId: targetUserId },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeValues: expressionValues
    }));

    console.log('Subscription tier updated:', { targetUserId, oldTier, newTier });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Subscription tier updated: ${oldTier} → ${newTier}`,
        user: {
          userId: targetUserId,
          oldTier,
          newTier,
          monthlyLimit: tierLimits[newTier]
        }
      })
    };
  } catch (error) {
    console.error('Update subscription tier error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'SERVER_ERROR', message: error.message })
    };
  }
}

// 사용자 메시지 할당량 리셋
async function resetUserQuota(event, headers) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { adminUserId, targetUserId } = body;

    console.log('Resetting quota for user:', { adminUserId, targetUserId });

    // 관리자 권한 확인
    const adminUser = await dynamoClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId: adminUserId }
    }));

    if (!adminUser.Item || adminUser.Item.role !== 'ADMIN') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'FORBIDDEN', message: 'Admin access required' })
      };
    }

    const today = new Date().toISOString().split('T')[0];
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const firstDayNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1)
      .toISOString().split('T')[0];

    await dynamoClient.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId: targetUserId },
      UpdateExpression: `
        SET messageQuota.currentMonthUsage = :zero,
            messageQuota.lastResetDate = :today,
            messageQuota.nextResetDate = :nextMonth
      `,
      ExpressionAttributeValues: {
        ':zero': 0,
        ':today': today,
        ':nextMonth': firstDayNextMonth
      }
    }));

    console.log('Quota reset completed:', targetUserId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Message quota has been reset',
        userId: targetUserId,
        resetDate: today
      })
    };
  } catch (error) {
    console.error('Reset quota error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'SERVER_ERROR', message: error.message })
    };
  }
}

// 체험 기간 연장
async function extendTrialPeriod(event, headers) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { adminUserId, targetUserId, additionalDays } = body;

    console.log('Extending trial period:', { adminUserId, targetUserId, additionalDays });

    // 관리자 권한 확인
    const adminUser = await dynamoClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId: adminUserId }
    }));

    if (!adminUser.Item || adminUser.Item.role !== 'ADMIN') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'FORBIDDEN', message: 'Admin access required' })
      };
    }

    // 대상 사용자 조회
    const targetUser = await dynamoClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId: targetUserId }
    }));

    if (!targetUser.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'NOT_FOUND', message: 'User not found' })
      };
    }

    // TRIAL 티어가 아니면 에러
    if (targetUser.Item.subscriptionTier !== 'TRIAL') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'VALIDATION_ERROR',
          message: 'User is not on TRIAL tier',
          currentTier: targetUser.Item.subscriptionTier
        })
      };
    }

    // 현재 체험 종료일에서 연장
    const currentEndDate = targetUser.Item.trialPeriod?.endDate || new Date().toISOString();
    const newEndDate = new Date(currentEndDate);
    newEndDate.setDate(newEndDate.getDate() + (additionalDays || 30));

    const now = new Date();
    const daysRemaining = Math.ceil((newEndDate - now) / (1000 * 60 * 60 * 24));

    await dynamoClient.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId: targetUserId },
      UpdateExpression: `
        SET trialPeriod.endDate = :endDate,
            trialPeriod.isExpired = :isExpired,
            trialPeriod.daysRemaining = :daysRemaining
      `,
      ExpressionAttributeValues: {
        ':endDate': newEndDate.toISOString(),
        ':isExpired': false,
        ':daysRemaining': daysRemaining
      }
    }));

    console.log('Trial period extended:', { targetUserId, newEndDate: newEndDate.toISOString() });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Trial period extended by ${additionalDays} days`,
        userId: targetUserId,
        newEndDate: newEndDate.toISOString(),
        daysRemaining
      })
    };
  } catch (error) {
    console.error('Extend trial period error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'SERVER_ERROR', message: error.message })
    };
  }
}

// 구독 통계 조회
async function getSubscriptionStats(event, headers) {
  try {
    const adminUserId = event.queryStringParameters?.adminUserId;

    console.log('Getting subscription stats, adminUserId:', adminUserId);

    // 관리자 권한 확인
    const adminUser = await dynamoClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId: adminUserId }
    }));

    if (!adminUser.Item || adminUser.Item.role !== 'ADMIN') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'FORBIDDEN', message: 'Admin access required' })
      };
    }

    // 모든 사용자 조회
    const usersResponse = await dynamoClient.send(new ScanCommand({
      TableName: USERS_TABLE
    }));

    const users = usersResponse.Items || [];

    // 티어별 분포
    const tierDistribution = {
      FREE: 0,
      TRIAL: 0,
      PREMIUM: 0,
      UNLIMITED: 0
    };

    // 할당량 사용 통계
    let totalUsage = 0;
    let totalLimit = 0;
    let nearLimitUsers = 0;
    let exceededUsers = 0;

    // 체험 상태
    let activeTrials = 0;
    let expiringIn7Days = 0;
    let expiredTrials = 0;

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    users.forEach(user => {
      const tier = user.subscriptionTier || 'UNLIMITED';
      tierDistribution[tier]++;

      // 할당량 통계
      if (user.messageQuota && tier !== 'UNLIMITED') {
        const usage = user.messageQuota.currentMonthUsage || 0;
        const limit = user.messageQuota.monthlyLimit || 0;

        totalUsage += usage;
        totalLimit += limit;

        const usagePercent = limit > 0 ? (usage / limit) * 100 : 0;

        if (usagePercent >= 90) nearLimitUsers++;
        if (usage >= limit) exceededUsers++;
      }

      // 체험 통계 (TRIAL 티어만)
      if (tier === 'TRIAL' && user.trialPeriod) {
        const endDate = new Date(user.trialPeriod.endDate);

        if (endDate > now) {
          activeTrials++;
          if (endDate <= sevenDaysFromNow) {
            expiringIn7Days++;
          }
        } else {
          expiredTrials++;
        }
      }
    });

    const averageUsage = totalLimit > 0 ? (totalUsage / totalLimit) * 100 : 0;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        tierDistribution,
        quotaUsage: {
          averageUsage: Math.round(averageUsage * 10) / 10,
          nearLimitUsers,
          exceededUsers,
          totalUsage,
          totalLimit
        },
        trialStatus: {
          activeTrials,
          expiringIn7Days,
          expired: expiredTrials
        },
        totalUsers: users.length,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Get subscription stats error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'SERVER_ERROR', message: error.message })
    };
  }
}
