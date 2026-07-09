const required = ['JWT_SECRET', 'ADMIN_API_KEY', 'NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD'] as const;

export function validateEnv() {
  const missing = required.filter(key => !process.env[key]);
  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}
