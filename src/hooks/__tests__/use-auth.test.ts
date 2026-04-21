import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

const mockSignIn = vi.mocked(signInAction);
const mockSignUp = vi.mocked(signUpAction);
const mockGetAnonWorkData = vi.mocked(getAnonWorkData);
const mockClearAnonWork = vi.mocked(clearAnonWork);
const mockGetProjects = vi.mocked(getProjects);
const mockCreateProject = vi.mocked(createProject);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue({ id: "new-project-id" } as any);
});

describe("useAuth", () => {
  describe("initial state", () => {
    test("isLoading starts as false", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);
    });

    test("exposes signIn and signUp functions", () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
    });
  });

  describe("signIn", () => {
    test("returns error result when credentials are wrong", async () => {
      mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());
      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.signIn("bad@example.com", "wrong");
      });

      expect(returnValue).toEqual({ success: false, error: "Invalid credentials" });
      expect(mockPush).not.toHaveBeenCalled();
    });

    test("sets isLoading true while in-flight, false after", async () => {
      let resolveSignIn!: (v: any) => void;
      mockSignIn.mockReturnValue(new Promise((r) => { resolveSignIn = r; }));

      const { result } = renderHook(() => useAuth());

      act(() => { result.current.signIn("u@example.com", "pass"); });
      expect(result.current.isLoading).toBe(true);

      await act(async () => { resolveSignIn({ success: false, error: "err" }); });
      expect(result.current.isLoading).toBe(false);
    });

    test("resets isLoading to false even when signIn throws", async () => {
      mockSignIn.mockRejectedValue(new Error("network error"));

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("u@example.com", "pass").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });

    describe("post-sign-in navigation", () => {
      test("saves anon work as a new project and redirects when anon work exists", async () => {
        const anonWork = {
          messages: [{ role: "user", content: "Hello" }],
          fileSystemData: { "/App.tsx": { type: "file", content: "code" } },
        };
        mockSignIn.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue(anonWork);
        mockCreateProject.mockResolvedValue({ id: "anon-project-id" } as any);

        const { result } = renderHook(() => useAuth());
        await act(async () => { await result.current.signIn("u@example.com", "pass"); });

        expect(mockCreateProject).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: anonWork.messages,
            data: anonWork.fileSystemData,
          })
        );
        expect(mockClearAnonWork).toHaveBeenCalled();
        expect(mockGetProjects).not.toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
      });

      test("skips anon work path when messages array is empty", async () => {
        mockSignIn.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
        mockGetProjects.mockResolvedValue([{ id: "existing-id" } as any]);

        const { result } = renderHook(() => useAuth());
        await act(async () => { await result.current.signIn("u@example.com", "pass"); });

        expect(mockCreateProject).not.toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/existing-id");
      });

      test("redirects to most recent project when user has projects and no anon work", async () => {
        mockSignIn.mockResolvedValue({ success: true });
        mockGetProjects.mockResolvedValue([
          { id: "recent-project" } as any,
          { id: "older-project" } as any,
        ]);

        const { result } = renderHook(() => useAuth());
        await act(async () => { await result.current.signIn("u@example.com", "pass"); });

        expect(mockPush).toHaveBeenCalledWith("/recent-project");
        expect(mockCreateProject).not.toHaveBeenCalled();
      });

      test("creates a new project and redirects when user has no projects and no anon work", async () => {
        mockSignIn.mockResolvedValue({ success: true });
        mockGetProjects.mockResolvedValue([]);
        mockCreateProject.mockResolvedValue({ id: "brand-new-id" } as any);

        const { result } = renderHook(() => useAuth());
        await act(async () => { await result.current.signIn("u@example.com", "pass"); });

        expect(mockCreateProject).toHaveBeenCalledWith(
          expect.objectContaining({ messages: [], data: {} })
        );
        expect(mockPush).toHaveBeenCalledWith("/brand-new-id");
      });

      test("does not navigate when sign-in fails", async () => {
        mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });

        const { result } = renderHook(() => useAuth());
        await act(async () => { await result.current.signIn("u@example.com", "pass"); });

        expect(mockGetProjects).not.toHaveBeenCalled();
        expect(mockCreateProject).not.toHaveBeenCalled();
        expect(mockPush).not.toHaveBeenCalled();
      });

      test("returns the result from the server action", async () => {
        mockSignIn.mockResolvedValue({ success: true });
        mockGetProjects.mockResolvedValue([{ id: "p1" } as any]);

        const { result } = renderHook(() => useAuth());
        let returnValue: any;
        await act(async () => {
          returnValue = await result.current.signIn("u@example.com", "pass");
        });

        expect(returnValue).toEqual({ success: true });
      });
    });
  });

  describe("signUp", () => {
    test("returns error result on failure", async () => {
      mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());
      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.signUp("taken@example.com", "password123");
      });

      expect(returnValue).toEqual({ success: false, error: "Email already registered" });
      expect(mockPush).not.toHaveBeenCalled();
    });

    test("sets isLoading true while in-flight, false after", async () => {
      let resolveSignUp!: (v: any) => void;
      mockSignUp.mockReturnValue(new Promise((r) => { resolveSignUp = r; }));

      const { result } = renderHook(() => useAuth());

      act(() => { result.current.signUp("u@example.com", "pass"); });
      expect(result.current.isLoading).toBe(true);

      await act(async () => { resolveSignUp({ success: false }); });
      expect(result.current.isLoading).toBe(false);
    });

    test("resets isLoading when signUp throws", async () => {
      mockSignUp.mockRejectedValue(new Error("server error"));

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("u@example.com", "pass").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("saves anon work and redirects on success when anon work exists", async () => {
      const anonWork = {
        messages: [{ role: "user", content: "Hello" }],
        fileSystemData: { "/App.tsx": { type: "file", content: "code" } },
      };
      mockSignUp.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(anonWork);
      mockCreateProject.mockResolvedValue({ id: "signup-anon-id" } as any);

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signUp("new@example.com", "password123"); });

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: anonWork.messages,
          data: anonWork.fileSystemData,
        })
      );
      expect(mockClearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/signup-anon-id");
    });

    test("redirects to most recent project on success when projects exist", async () => {
      mockSignUp.mockResolvedValue({ success: true });
      mockGetProjects.mockResolvedValue([{ id: "p1" } as any, { id: "p2" } as any]);

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signUp("new@example.com", "password123"); });

      expect(mockPush).toHaveBeenCalledWith("/p1");
    });

    test("creates a new project on success when no projects exist", async () => {
      mockSignUp.mockResolvedValue({ success: true });
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "fresh-id" } as any);

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signUp("new@example.com", "password123"); });

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({ messages: [], data: {} })
      );
      expect(mockPush).toHaveBeenCalledWith("/fresh-id");
    });

    test("does not navigate when sign-up fails", async () => {
      mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signUp("taken@example.com", "pass"); });

      expect(mockGetProjects).not.toHaveBeenCalled();
      expect(mockCreateProject).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
