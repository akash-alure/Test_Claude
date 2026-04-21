import { test, expect, describe } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToolInvocationBadge, getToolLabel } from "../ToolInvocationBadge";

// Helpers
function makeInvocation(
  toolName: string,
  args: Record<string, unknown>,
  state: "call" | "result" = "result",
  result: unknown = "ok"
) {
  return { toolCallId: "test-id", toolName, args, state, result: state === "result" ? result : undefined };
}

describe("getToolLabel", () => {
  test("str_replace_editor create", () => {
    expect(getToolLabel("str_replace_editor", { command: "create", path: "/App.tsx" })).toBe("Creating App.tsx");
  });

  test("str_replace_editor str_replace", () => {
    expect(getToolLabel("str_replace_editor", { command: "str_replace", path: "/components/Button.tsx" })).toBe("Editing Button.tsx");
  });

  test("str_replace_editor insert", () => {
    expect(getToolLabel("str_replace_editor", { command: "insert", path: "/App.tsx" })).toBe("Editing App.tsx");
  });

  test("str_replace_editor view", () => {
    expect(getToolLabel("str_replace_editor", { command: "view", path: "/App.tsx" })).toBe("Viewing App.tsx");
  });

  test("str_replace_editor undo_edit", () => {
    expect(getToolLabel("str_replace_editor", { command: "undo_edit", path: "/App.tsx" })).toBe("Reverting App.tsx");
  });

  test("file_manager rename", () => {
    expect(getToolLabel("file_manager", { command: "rename", path: "/old.tsx", new_path: "/new.tsx" })).toBe("Renaming old.tsx → new.tsx");
  });

  test("file_manager delete", () => {
    expect(getToolLabel("file_manager", { command: "delete", path: "/App.tsx" })).toBe("Deleting App.tsx");
  });

  test("unknown tool falls back to tool name", () => {
    expect(getToolLabel("some_other_tool", {})).toBe("some_other_tool");
  });

  test("str_replace_editor with unknown command falls back to tool name", () => {
    expect(getToolLabel("str_replace_editor", { command: "unknown" })).toBe("str_replace_editor");
  });

  test("uses full path when no slash present", () => {
    expect(getToolLabel("str_replace_editor", { command: "create", path: "App.tsx" })).toBe("Creating App.tsx");
  });
});

describe("ToolInvocationBadge rendering", () => {
  test("shows friendly label for create command", () => {
    render(<ToolInvocationBadge toolInvocation={makeInvocation("str_replace_editor", { command: "create", path: "/App.tsx" })} />);
    expect(screen.getByText("Creating App.tsx")).toBeDefined();
  });

  test("shows friendly label for str_replace command", () => {
    render(<ToolInvocationBadge toolInvocation={makeInvocation("str_replace_editor", { command: "str_replace", path: "/Card.tsx" })} />);
    expect(screen.getByText("Editing Card.tsx")).toBeDefined();
  });

  test("shows green dot when done", () => {
    const { container } = render(
      <ToolInvocationBadge toolInvocation={makeInvocation("str_replace_editor", { command: "create", path: "/App.tsx" }, "result", "ok")} />
    );
    expect(container.querySelector(".bg-emerald-500")).toBeDefined();
  });

  test("shows spinner when pending", () => {
    const { container } = render(
      <ToolInvocationBadge toolInvocation={makeInvocation("str_replace_editor", { command: "create", path: "/App.tsx" }, "call")} />
    );
    expect(container.querySelector(".animate-spin")).toBeDefined();
  });

  test("shows file_manager delete label", () => {
    render(<ToolInvocationBadge toolInvocation={makeInvocation("file_manager", { command: "delete", path: "/old.tsx" })} />);
    expect(screen.getByText("Deleting old.tsx")).toBeDefined();
  });

  test("shows file_manager rename label", () => {
    render(<ToolInvocationBadge toolInvocation={makeInvocation("file_manager", { command: "rename", path: "/old.tsx", new_path: "/new.tsx" })} />);
    expect(screen.getByText("Renaming old.tsx → new.tsx")).toBeDefined();
  });

  test("falls back to tool name for unknown tool", () => {
    render(<ToolInvocationBadge toolInvocation={makeInvocation("mystery_tool", {})} />);
    expect(screen.getByText("mystery_tool")).toBeDefined();
  });
});
