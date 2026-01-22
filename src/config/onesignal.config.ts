import { registerAs } from '@nestjs/config';

export default registerAs('onesignal', () => ({
  appId: process.env.ONESIGNAL_APP_ID,
  apiKey: process.env.ONESIGNAL_API_KEY,
}));
