import { GetCommand, PutCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "../lib/clients.mjs";
import { TABLES } from "../lib/config.mjs";

export async function getUserProfile(event, headers) {
  const userId = event.pathParameters?.userId || event.path.split('/').pop();

  try {
    const response = await dynamoClient.send(new QueryCommand({
      TableName: TABLES.USERS,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId
      }
    }));

    if (!response.Items || response.Items.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "User not found" })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response.Items[0])
    };
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

export async function createUserProfile(event, headers) {
  try {
    const body = JSON.parse(event.body || "{}");
    const { userId, username, name, organization, role = 'USER', level = 1, title = '초보 탐험가' } = body;

    if (!userId || !username) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing required fields: userId, username" })
      };
    }

    await dynamoClient.send(new PutCommand({
      TableName: TABLES.USERS,
      Item: {
        userId,
        username,
        name: name || username,
        organization: organization || '',
        role,
        level,
        title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        userId,
        username,
        name: name || username,
        role,
        level,
        title
      })
    };
  } catch (error) {
    console.error("Error creating user profile:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

export async function updateUserProfile(event, headers) {
  const body = JSON.parse(event.body || "{}");
  const { userId, name, organization } = body;

  if (!userId || !name) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing required fields: userId, name" })
    };
  }

  try {
    // organization이 제공된 경우에만 업데이트
    const updateExpression = organization !== undefined
      ? "SET #name = :name, #organization = :organization, updatedAt = :updatedAt"
      : "SET #name = :name, updatedAt = :updatedAt";

    const expressionAttributeNames = organization !== undefined
      ? { "#name": "name", "#organization": "organization" }
      : { "#name": "name" };

    const expressionAttributeValues = organization !== undefined
      ? { ":name": name, ":organization": organization, ":updatedAt": new Date().toISOString() }
      : { ":name": name, ":updatedAt": new Date().toISOString() };

    const result = await dynamoClient.send(new UpdateCommand({
      TableName: TABLES.USERS,
      Key: { userId },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW"
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result.Attributes)
    };
  } catch (error) {
    console.error("Error updating user profile:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}
