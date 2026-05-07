const { backupProject } = require('./backup');

/**
 * Main Lambda handler
 * Triggered daily by EventBridge to backup all configured projects
 */
exports.handler = async (event) => {
  console.log('Starting nexus-backup...');
  
  const projects = JSON.parse(process.env.PROJECTS || '[]');
  const results = {
    success: [],
    failed: [],
    totalBackups: 0,
    totalSize: 0
  };

  for (const project of projects) {
    try {
      console.log(`Backing up project: ${project.name}`);
      
      const projectResults = await backupProject(project);
      
      results.success.push({
        project: project.name,
        databases: projectResults.databases.length,
        size: projectResults.totalSize
      });
      
      results.totalBackups += projectResults.databases.length;
      results.totalSize += projectResults.totalSize;
      
    } catch (error) {
      console.error(`Failed to backup ${project.name}:`, error);
      results.failed.push({
        project: project.name,
        error: error.message
      });
    }
  }

  console.log('Backup summary:', JSON.stringify(results, null, 2));

  return {
    statusCode: results.failed.length > 0 ? 207 : 200,
    body: JSON.stringify(results)
  };
};
