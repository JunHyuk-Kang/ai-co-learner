import { CORS_HEADERS } from "./lib/config.mjs";
import { getSession, sendChatMessage, sendChatMessageStream } from "./handlers/chat.mjs";
import { getTemplates, getUserBots, createUserBot, deleteUserBot, getRecommendedTemplates } from "./handlers/bot.mjs";
import { createTemplate, updateTemplate, deleteTemplate, getAllUsers, updateUserRole, getUsageStats, updateUserInfo, blockUser, getDashboardStats, getOrganizationList, updateGroupTier } from "./handlers/admin.mjs";
import { startAssessment, submitAssessmentAnswer, getAssessmentResults } from "./handlers/assessment.mjs";
import { getUserProfile, createUserProfile, updateUserProfile } from "./handlers/user.mjs";
import { getUserQuests, getCompetencyHistory, getUserAchievements, getLearningAnalysis, getUserCompetencies } from "./handlers/dashboard.mjs";
import { updateSubscriptionTier, resetUserQuota, extendTrialPeriod, getSubscriptionStats } from "./handlers/subscription.mjs";

export const handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  if (event.httpMethod === 'OPTIONS' || event.requestContext?.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'OK' })
    };
  }

  const headers = CORS_HEADERS;

  try {
    const path = event.path || event.resource;
    const method = event.httpMethod;

    // Chat
    if (method === 'GET' && path.includes('/chat/session/')) return await getSession(event, headers);
    if (method === 'POST' && path.includes('/chat/stream')) return await sendChatMessageStream(event, headers);
    if (method === 'POST' && path.includes('/chat') && !path.includes('/stream')) return await sendChatMessage(event, headers);

    // Bots
    if (method === 'GET' && path.includes('/bots/templates')) return await getTemplates(event, headers);
    if (method === 'GET' && path.includes('/bots/user/')) return await getUserBots(event, headers);
    if (method === 'POST' && path.includes('/bots/create')) return await createUserBot(event, headers);
    if (method === 'POST' && path.includes('/bots/delete')) return await deleteUserBot(event, headers);
    if (method === 'GET' && path.includes('/bots/recommended/')) return await getRecommendedTemplates(event, headers);

    // Admin
    if (method === 'POST' && path.includes('/admin/templates/create')) return await createTemplate(event, headers);
    if (method === 'POST' && path.includes('/admin/templates/update')) return await updateTemplate(event, headers);
    if (method === 'POST' && path.includes('/admin/templates/delete')) return await deleteTemplate(event, headers);
    if (method === 'GET' && path.includes('/admin/users')) return await getAllUsers(event, headers);
    if (method === 'POST' && path.includes('/admin/users/update-role')) return await updateUserRole(event, headers);
    if (method === 'POST' && path.includes('/admin/users/update-info')) return await updateUserInfo(event, headers);
    if (method === 'POST' && path.includes('/admin/users/block')) return await blockUser(event, headers);
    if (method === 'GET' && path.includes('/admin/usage')) return await getUsageStats(event, headers);
    if (method === 'GET' && path.includes('/admin/dashboard')) return await getDashboardStats(event, headers);
    if (method === 'GET' && path.includes('/admin/subscription/organizations')) return await getOrganizationList(event, headers);
    if (method === 'POST' && path.includes('/admin/subscription/update-group-tier')) return await updateGroupTier(event, headers);

    // Subscription
    if (method === 'POST' && path.includes('/admin/subscription/update-tier')) return await updateSubscriptionTier(event, headers);
    if (method === 'POST' && path.includes('/admin/subscription/reset-quota')) return await resetUserQuota(event, headers);
    if (method === 'POST' && path.includes('/admin/subscription/extend-trial')) return await extendTrialPeriod(event, headers);
    if (method === 'GET' && path.includes('/admin/subscription/stats')) return await getSubscriptionStats(event, headers);

    // Assessment
    if (method === 'POST' && path.includes('/assessment/start')) return await startAssessment(event, headers);
    if (method === 'POST' && path.includes('/assessment/submit')) return await submitAssessmentAnswer(event, headers);
    if (method === 'GET' && path.includes('/assessment/results')) return await getAssessmentResults(event, headers);

    // Dashboard / User Stats
    if (method === 'GET' && path.includes('/quests/')) return await getUserQuests(event, headers);
    if (method === 'GET' && path.includes('/achievements/')) return await getUserAchievements(event, headers);
    if (method === 'GET' && path.includes('/analysis/')) return await getLearningAnalysis(event, headers);
    if (method === 'GET' && path.includes('/competencies/history')) return await getCompetencyHistory(event, headers);
    if (method === 'GET' && path.includes('/competencies') && path.includes('/users/')) return await getUserCompetencies(event, headers);

    // User Profile
    if (method === 'GET' && path.includes('/users/')) return await getUserProfile(event, headers);
    if (method === 'POST' && path.includes('/users') && !path.includes('/update') && !path.includes('/admin')) return await createUserProfile(event, headers);
    if (method === 'POST' && path.includes('/users/update') && !path.includes('/admin')) return await updateUserProfile(event, headers);

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Route not found' })
    };

  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message,
        type: error.name
      })
    };
  }
};