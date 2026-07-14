import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Helper to resolve paths safely within the project root
function safePath(relPath) {
  const resolved = path.resolve(ROOT_DIR, relPath);
  if (!resolved.startsWith(ROOT_DIR)) {
    throw new Error(`Access denied: path traversal detected: ${relPath}`);
  }
  return resolved;
}

// 1. Tool: List files (flat list for AI efficiency)
function listFiles() {
  const listFilesRecursively = (dir, relativeDir = '') => {
    let results = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
      if (
        file === 'node_modules' || 
        file === '.git' || 
        file === '.next' || 
        file === 'dist' || 
        file === '.agents' ||
        file === 'package-lock.json'
      ) {
        continue;
      }
      const fullPath = path.join(dir, file);
      const relPath = path.join(relativeDir, file).replace(/\\/g, '/');
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        results.push(...listFilesRecursively(fullPath, relPath));
      } else {
        results.push(relPath);
      }
    }
    return results;
  };
  
  const files = listFilesRecursively(ROOT_DIR);
  return files.length > 0 ? files.join('\n') : '(no files found in workspace)';
}

// 2. Tool: Read file content
function readFile(relPath) {
  try {
    const abs = safePath(relPath);
    if (!fs.existsSync(abs)) {
      return `Error: File not found: ${relPath}`;
    }
    if (fs.statSync(abs).isDirectory()) {
      return `Error: Path is a directory: ${relPath}`;
    }
    return fs.readFileSync(abs, 'utf8');
  } catch (err) {
    return `Error reading file ${relPath}: ${err.message}`;
  }
}

// 3. Tool: Write file content
function writeFile(relPath, content) {
  try {
    const abs = safePath(relPath);
    const parent = path.dirname(abs);
    if (!fs.existsSync(parent)) {
      fs.mkdirSync(parent, { recursive: true });
    }
    fs.writeFileSync(abs, content, 'utf8');
    return `Success: Wrote file: ${relPath}`;
  } catch (err) {
    return `Error writing file ${relPath}: ${err.message}`;
  }
}

// 4. Tool: Execute command
function executeCommand(command, onProgress) {
  return new Promise((resolve) => {
    onProgress({ type: 'command_start', command });
    
    // Use cmd.exe shell on Windows for maximum compatibility with npm, python, etc.
    const child = spawn(command, { cwd: ROOT_DIR, shell: true });
    let output = '';
    let resolved = false;
    
    const finish = (msg) => {
      if (resolved) return;
      resolved = true;
      resolve(msg);
    };

    child.stdout.on('data', (data) => {
      const str = data.toString();
      output += str;
      onProgress({ type: 'command_output', data: str });
      
      // If server markers appear, resolve early so the agent loop doesn't block
      if (str.includes('http://') || str.includes('localhost') || str.includes('Server running') || str.includes('compiled successfully')) {
        setTimeout(() => finish(`Command started and running in background. Current output:\n${output}`), 1500);
      }
    });
    
    child.stderr.on('data', (data) => {
      const str = data.toString();
      output += str;
      onProgress({ type: 'command_output', data: str });
    });
    
    child.on('close', (code) => {
      onProgress({ type: 'command_end', code });
      finish(`Command exited with code ${code}.\nOutput:\n${output}`);
    });
    
    child.on('error', (err) => {
      onProgress({ type: 'command_end', code: -1 });
      finish(`Command launch failed: ${err.message}`);
    });

    // If it keeps running for 5 seconds without exiting, resolve early (run in background)
    setTimeout(() => {
      finish(`Command is running in background. Output so far:\n${output}`);
    }, 5000);
  });
}

// XML Response Tag Parser
function parseXmlTags(text) {
  const thoughtMatch = text.match(/<thought>([\s\S]*?)<\/thought>/);
  const thought = thoughtMatch ? thoughtMatch[1].trim() : '';

  const toolCallMatch = text.match(/<tool_call>([\s\S]*?)<\/tool_call>/);
  if (!toolCallMatch) {
    return { thought, toolCall: null };
  }

  const toolCallContent = toolCallMatch[1];
  const nameMatch = toolCallContent.match(/<name>(.*?)<\/name>/);
  const name = nameMatch ? nameMatch[1].trim() : '';

  const args = {};
  if (name === 'read_file' || name === 'write_file') {
    const pathMatch = toolCallContent.match(/<path>(.*?)<\/path>/);
    args.path = pathMatch ? pathMatch[1].trim() : '';
  }
  if (name === 'write_file') {
    const cdataMatch = toolCallContent.match(/<content><!\[CDATA\[([\s\S]*?)\]\]><\/content>/);
    if (cdataMatch) {
      args.content = cdataMatch[1];
    } else {
      const contentMatch = toolCallContent.match(/<content>([\s\S]*?)<\/content>/);
      args.content = contentMatch ? contentMatch[1] : '';
    }
  }
  if (name === 'execute_command') {
    const commandMatch = toolCallContent.match(/<command>([\s\S]*?)<\/command>/);
    args.command = commandMatch ? commandMatch[1].trim() : '';
  }
  if (name === 'finish_task') {
    const msgMatch = toolCallContent.match(/<message>([\s\S]*?)<\/message>/);
    args.message = msgMatch ? msgMatch[1].trim() : '';
  }

  return {
    thought,
    toolCall: { name, arguments: args }
  };
}

const SYSTEM_PROMPT = `You are NIMbus Coder, an advanced AI coding assistant running inside a local workspace environment.
You can read/write files and execute command-line instructions to build websites, utilities, scripts, or debug issues.

You have access to the following tools:
1. list_files: Lists all files in the workspace (excluding build folders).
   Format:
   <tool_call>
     <name>list_files</name>
   </tool_call>

2. read_file: Reads the contents of a file.
   Format:
   <tool_call>
     <name>read_file</name>
     <arguments>
       <path>relative/path/to/file</path>
     </arguments>
   </tool_call>

3. write_file: Writes content to a file, creating parent directories automatically. Wrap file content inside <![CDATA[ ... ]]> block.
   Format:
   <tool_call>
     <name>write_file</name>
     <arguments>
       <path>relative/path/to/file</path>
       <content><![CDATA[
FILE CONTENTS HERE
]]]]><![CDATA[></content>
     </arguments>
   </tool_call>

4. execute_command: Runs a command in the shell. If starting a server, it will run in the background.
   Format:
   <tool_call>
     <name>execute_command</name>
     <arguments>
       <command>command to run</command>
     </arguments>
   </tool_call>

5. finish_task: Ends the agent loop with a summary of accomplishment.
   Format:
   <tool_call>
     <name>finish_task</name>
     <arguments>
       <message>Task summary</message>
     </arguments>
   </tool_call>

CRITICAL RULES:
- You must explain your thought process in a <thought>...</thought> block BEFORE issuing a <tool_call>...</tool_call> block.
- Always execute exactly one tool call per turn. Do not call multiple tools.
- Never output anything outside of the <thought> and <tool_call> blocks.
- If a command fails or files are missing, investigate and modify/fix files accordingly.
`;

export async function runAgent(userPrompt, apiKey, modelName, onEvent) {
  const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://integrate.api.nvidia.com/v1',
  });

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt }
  ];

  let loopCount = 0;
  const maxLoops = 15;

  while (loopCount < maxLoops) {
    loopCount++;
    onEvent({ type: 'loop_start', loop: loopCount });
    onEvent({ type: 'status', message: `Calling NVIDIA NIM completions (${modelName})...` });

    let responseText = '';
    try {
      const stream = await openai.chat.completions.create({
        model: modelName,
        messages: messages,
        temperature: 0.2,
        stream: true,
      });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || '';
        responseText += text;
        onEvent({ type: 'chunk', text });
      }
    } catch (apiError) {
      onEvent({ type: 'status', message: `API Error: ${apiError.message}` });
      throw apiError;
    }

    onEvent({ type: 'response_complete', text: responseText });

    const { thought, toolCall } = parseXmlTags(responseText);
    
    if (thought) {
      onEvent({ type: 'thought', text: thought });
    }

    if (!toolCall) {
      onEvent({ type: 'status', message: 'Parsing failed: tool call not structured correctly. Nudging model...' });
      messages.push({ role: 'assistant', content: responseText });
      messages.push({ role: 'user', content: 'Please output your response using the XML <thought> and <tool_call> tags.' });
      continue;
    }

    onEvent({ type: 'tool_start', name: toolCall.name, arguments: toolCall.arguments });

    let result = '';
    try {
      if (toolCall.name === 'list_files') {
        result = listFiles();
      } else if (toolCall.name === 'read_file') {
        result = readFile(toolCall.arguments.path);
      } else if (toolCall.name === 'write_file') {
        result = writeFile(toolCall.arguments.path, toolCall.arguments.content);
      } else if (toolCall.name === 'execute_command') {
        result = await executeCommand(toolCall.arguments.command, (cmdEvent) => {
          onEvent({ type: 'cmd_progress', data: cmdEvent });
        });
      } else if (toolCall.name === 'finish_task') {
        onEvent({ type: 'finish', message: toolCall.arguments.message });
        return;
      } else {
        result = `Error: Unknown tool: ${toolCall.name}`;
      }
    } catch (toolError) {
      result = `Error executing tool: ${toolError.message}`;
    }

    onEvent({ type: 'tool_end', name: toolCall.name, result });

    messages.push({ role: 'assistant', content: responseText });
    messages.push({
      role: 'user',
      content: `<tool_result>\n${result}\n</tool_result>`
    });
  }

  throw new Error('Agent exceeded maximum recursion limit.');
}
