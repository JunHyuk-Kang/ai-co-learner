import { Amplify } from 'aws-amplify';

const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '',
      region: import.meta.env.VITE_COGNITO_REGION || 'ap-northeast-2',
      loginWith: {
        email: false,
        username: true,
      },
      signUpVerificationMethod: 'code',
      userAttributes: {
        name: {
          required: true,
        },
      },
    },
  },
  API: {
    REST: {
      'ai-co-learner-api': {
        endpoint: import.meta.env.VITE_API_GATEWAY_URL || '',
        region: import.meta.env.VITE_COGNITO_REGION || 'ap-northeast-2',
      },
    },
  },
};

export const configureAmplify = () => {
  Amplify.configure(awsConfig);
};

export default awsConfig;
