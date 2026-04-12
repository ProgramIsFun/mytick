const required = ['MONGODB_URI', 'JWT_SECRET', 'ADMIN_API_KEY'] as const;

export function validateEnv() {
  const missing = required.filter(key => !process.env[key]);
  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}
