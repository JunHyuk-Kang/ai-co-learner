import { GoogleGenerativeAI } from "@google/generative-ai";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { REGION, GEMINI_API_KEY } from "./config.mjs";

export const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION })
);

export const lambdaClient = new LambdaClient({ region: REGION });

export const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });
