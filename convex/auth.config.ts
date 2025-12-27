import { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      domain: process.env.AUTH0_DOMAIN!,          // must equal token `iss`
      applicationID: process.env.AUTH0_CLIENT_ID! // must equal token `aud`
    }
  ]
} satisfies AuthConfig;
