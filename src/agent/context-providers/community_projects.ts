import { db } from '@/db';
import { communityProjects } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function getCommunityProjectsContext(communityId: string): Promise<string> {
  const projects = await db.query.communityProjects.findMany({
    where: eq(communityProjects.community_id, communityId),
  });

  if (!projects || projects.length === 0) {
    return '';
  }

  let context = 'Here are the key projects, products, and features currently being worked on within the community.:\n\n';

  projects.forEach((project, index) => {
    context += `${index + 1}. ${project.name} (${project.type})\n`;
    context += `   Description: ${project.description}\n`;
    context += `   Status: ${project.status}\n`;
    
    if (project.key_contributors && project.key_contributors.length > 0) {
      context += `   Key Contributors: ${project.key_contributors.join(',')}\n`;
    }
    
    if (project.current_progress) {
      context += `   Current Progress: ${project.current_progress}\n`;
    }
    
    if (project.related_resources && project.related_resources.length > 0) {
      context += '   Related Resources:\n';
      project.related_resources.forEach((resource: string) => {
        context += `   - ${resource}\n`;
      });
    }
    
    context += '\n';
  });

  return context;
} 