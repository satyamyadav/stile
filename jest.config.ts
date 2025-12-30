/**
 * Root Jest configuration for Nx workspace
 * 
 * This file configures Jest multi-project support, allowing editor/IDE
 * integrations to pick up individual project configurations.
 * 
 * @see https://nx.dev/docs/technologies/test-tools/jest/introduction
 */
import { getJestProjectsAsync } from '@nx/jest';

export default async () => ({
  projects: await getJestProjectsAsync(),
});

