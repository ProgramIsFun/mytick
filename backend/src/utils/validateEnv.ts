const required = ['JWT_SECRET', 'ADMIN_API_KEY'] as const;

export function validateEnv() {
  const engine = process.env.DB_ENGINE || 'mongodb';
  const allRequired = [...required];

  if (engine === 'mongodb') {
    allRequired.push('MONGODB_URI' as any);
  }

  const missing = allRequired.filter(key => !process.env[key]);
  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}
