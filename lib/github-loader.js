import simpleGit from 'simple-git';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Document } from "@langchain/core/documents";

// File extensions to extract from repos
const CODE_EXTENSIONS = [
    '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', '.rs', '.rb', '.php',
    '.c', '.cpp', '.h', '.hpp', '.cs', '.swift', '.kt', '.scala',
    '.html', '.css', '.scss', '.sass', '.less',
    '.json', '.yaml', '.yml', '.toml', '.xml',
    '.md', '.mdx', '.txt', '.rst',
    '.sql', '.sh', '.bash', '.zsh', '.ps1',
    '.dockerfile', '.dockerignore', '.gitignore',
    '.env.example', '.eslintrc', '.prettierrc'
];

// Directories to skip
const SKIP_DIRS = [
    'node_modules', '.git', '.next', 'dist', 'build', 'out',
    '__pycache__', '.venv', 'venv', '.idea', '.vscode',
    'coverage', '.nyc_output', 'vendor', 'target'
];

// Max file size to process (500KB)
const MAX_FILE_SIZE = 500 * 1024;

/**
 * Clone a GitHub repo and extract code files as LangChain Documents
 * @param {string} repoUrl - GitHub URL (e.g., https://github.com/user/repo)
 * @param {string} notebookId - Notebook ID for metadata
 * @returns {Promise<Document[]>} - Array of Document objects
 */
export async function loadGitHubRepo(repoUrl, notebookId) {
    const tempDir = path.join(os.tmpdir(), `devmind-${Date.now()}`);
    const git = simpleGit();

    try {
        console.log(`Cloning ${repoUrl} to ${tempDir}...`);

        // Clone with depth 1 for speed (only latest commit)
        await git.clone(repoUrl, tempDir, ['--depth', '1']);

        console.log('Clone complete. Extracting files...');

        // Extract repo name from URL
        const repoName = extractRepoName(repoUrl);

        // Recursively find all code files
        const documents = [];
        await walkDirectory(tempDir, tempDir, repoName, notebookId, documents);

        console.log(`Extracted ${documents.length} documents from ${repoName}`);

        return documents;
    } finally {
        // Cleanup temp directory
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
            console.log('Cleaned up temp directory');
        } catch (e) {
            console.warn('Failed to cleanup temp dir:', e.message);
        }
    }
}

/**
 * Extract repo name from GitHub URL
 */
function extractRepoName(url) {
    // Handle various GitHub URL formats
    const match = url.match(/github\.com[/:]([\w.-]+)\/([\w.-]+)/);
    if (match) {
        return `${match[1]}/${match[2].replace(/\.git$/, '')}`;
    }
    return url;
}

/**
 * Recursively walk directory and collect code files
 */
async function walkDirectory(baseDir, currentDir, repoName, notebookId, documents) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);

        if (entry.isDirectory()) {
            // Skip ignored directories
            if (!SKIP_DIRS.includes(entry.name)) {
                await walkDirectory(baseDir, fullPath, repoName, notebookId, documents);
            }
        } else if (entry.isFile()) {
            // Check if file extension is in our list
            const ext = path.extname(entry.name).toLowerCase();
            const baseName = entry.name.toLowerCase();

            // Include if extension matches OR it's a known config file
            const shouldInclude = CODE_EXTENSIONS.includes(ext) ||
                CODE_EXTENSIONS.some(e => baseName.endsWith(e));

            if (shouldInclude) {
                try {
                    const stats = fs.statSync(fullPath);

                    // Skip files that are too large
                    if (stats.size > MAX_FILE_SIZE) {
                        console.log(`Skipping large file: ${relativePath} (${Math.round(stats.size / 1024)}KB)`);
                        continue;
                    }

                    const content = fs.readFileSync(fullPath, 'utf-8');

                    // Skip binary or empty files
                    if (!content || content.includes('\0')) {
                        continue;
                    }

                    // Split large files into chunks by lines
                    const lines = content.split('\n');
                    const CHUNK_SIZE = 100; // lines per chunk

                    for (let i = 0; i < lines.length; i += CHUNK_SIZE) {
                        const chunkLines = lines.slice(i, i + CHUNK_SIZE);
                        const startLine = i + 1;
                        const endLine = Math.min(i + CHUNK_SIZE, lines.length);

                        documents.push(new Document({
                            pageContent: chunkLines.join('\n'),
                            metadata: {
                                source: `${repoName}/${relativePath}`,
                                sourceType: 'github',
                                repoUrl: repoName,
                                filePath: relativePath,
                                lineStart: startLine,
                                lineEnd: endLine,
                                page: `L${startLine}-L${endLine}`,
                                notebookId
                            }
                        }));
                    }
                } catch (e) {
                    console.warn(`Failed to read ${relativePath}:`, e.message);
                }
            }
        }
    }
}

/**
 * Validate if a URL is a valid GitHub repo URL
 */
export function isValidGitHubUrl(url) {
    const githubPattern = /^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+(\.git)?$/;
    return githubPattern.test(url);
}
