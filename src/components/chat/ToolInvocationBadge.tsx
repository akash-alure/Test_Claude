import { Loader2 } from "lucide-react";

interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: string;
  result?: unknown;
}

interface ToolInvocationBadgeProps {
  toolInvocation: ToolInvocation;
}

function getToolLabel(toolName: string, args: Record<string, unknown>): string {
  const path = args.path as string | undefined;
  const filename = path ? path.split("/").pop() || path : "";

  if (toolName === "str_replace_editor") {
    const command = args.command as string | undefined;
    switch (command) {
      case "create":
        return `Creating ${filename}`;
      case "str_replace":
      case "insert":
        return `Editing ${filename}`;
      case "view":
        return `Viewing ${filename}`;
      case "undo_edit":
        return `Reverting ${filename}`;
    }
  }

  if (toolName === "file_manager") {
    const command = args.command as string | undefined;
    const newPath = args.new_path as string | undefined;
    const newFilename = newPath ? newPath.split("/").pop() || newPath : "";
    switch (command) {
      case "rename":
        return `Renaming ${filename} → ${newFilename}`;
      case "delete":
        return `Deleting ${filename}`;
    }
  }

  return toolName;
}

export function ToolInvocationBadge({ toolInvocation }: ToolInvocationBadgeProps) {
  const { toolName, args, state, result } = toolInvocation;
  const label = getToolLabel(toolName, args);
  const isDone = state === "result" && result !== undefined;

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {isDone ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      )}
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}

export { getToolLabel };
