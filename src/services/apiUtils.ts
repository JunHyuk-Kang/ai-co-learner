import { get, post, put, del } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth';

const API_NAME = 'ai-co-learner-api';

/**
 * Utility function to make authenticated API GET requests
 */
export async function apiGet<T>(path: string): Promise<T> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();

  const restOperation = get({
    apiName: API_NAME,
    path,
    options: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const response = await restOperation.response;
  return await response.body.json() as T;
}

/**
 * Utility function to make authenticated API POST requests
 */
export async function apiPost<T>(path: string, body: any): Promise<T> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();

  const restOperation = post({
    apiName: API_NAME,
    path,
    options: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body,
    },
  });

  const response = await restOperation.response;
  return await response.body.json() as T;
}

/**
 * Utility function to make authenticated API PUT requests
 */
export async function apiPut<T>(path: string, body: any): Promise<T> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();

  const restOperation = put({
    apiName: API_NAME,
    path,
    options: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body,
    },
  });

  const response = await restOperation.response;
  return await response.body.json() as T;
}

/**
 * Utility function to make authenticated API DELETE requests
 */
export async function apiDelete<T>(path: string): Promise<T> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();

  const restOperation = del({
    apiName: API_NAME,
    path,
    options: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const response = await restOperation.response;
  return await response.body.json() as T;
}
