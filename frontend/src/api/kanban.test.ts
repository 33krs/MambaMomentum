import { describe, expect, it, vi } from "vitest";

import apiClient from "./client";
import { createTask, deleteTask, fetchBoard, moveTask, updateTask } from "./kanban";

vi.mock("./client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedClient = vi.mocked(apiClient, true);

describe("kanban api", () => {
  it("fetchBoard calls GET /kanban/ and returns data", async () => {
    const board = { id: 1, columns: [] };
    mockedClient.get.mockResolvedValueOnce({ data: board });

    const result = await fetchBoard();

    expect(mockedClient.get).toHaveBeenCalledWith("/kanban/");
    expect(result).toEqual(board);
  });

  it("createTask calls POST /kanban/tasks with the input and returns data", async () => {
    const board = { id: 1, columns: [] };
    mockedClient.post.mockResolvedValueOnce({ data: board });
    const input = { column_id: 1, position: 0, title: "Nueva tarea", background_color: "#e2e8f0" };

    const result = await createTask(input);

    expect(mockedClient.post).toHaveBeenCalledWith("/kanban/tasks", input);
    expect(result).toEqual(board);
  });

  it("updateTask calls PATCH /kanban/tasks/{id} with the patch and returns data", async () => {
    const board = { id: 1, columns: [] };
    mockedClient.patch.mockResolvedValueOnce({ data: board });
    const patch = { title: "Actualizada" };

    const result = await updateTask(5, patch);

    expect(mockedClient.patch).toHaveBeenCalledWith("/kanban/tasks/5", patch);
    expect(result).toEqual(board);
  });

  it("moveTask calls PATCH /kanban/tasks/{id}/move with the move payload and returns data", async () => {
    const board = { id: 1, columns: [] };
    mockedClient.patch.mockResolvedValueOnce({ data: board });
    const move = { column_id: 2, position: 3 };

    const result = await moveTask(5, move);

    expect(mockedClient.patch).toHaveBeenCalledWith("/kanban/tasks/5/move", move);
    expect(result).toEqual(board);
  });

  it("deleteTask calls DELETE /kanban/tasks/{id}", async () => {
    mockedClient.delete.mockResolvedValueOnce({});

    await deleteTask(5);

    expect(mockedClient.delete).toHaveBeenCalledWith("/kanban/tasks/5");
  });
});
