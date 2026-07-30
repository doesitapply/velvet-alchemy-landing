import { describe, expect, it } from "vitest";
import {
  isDisposableLoopbackDatabase,
  requireDisposableLoopbackDatabase,
} from "./testSupport/disposableDatabase";

describe("disposable database test gate", () => {
  it("accepts only explicitly disposable loopback MySQL targets", () => {
    expect(
      isDisposableLoopbackDatabase(
        "mysql://root@127.0.0.1:3306/codex_velvet_loop"
      )
    ).toBe(true);
    expect(
      isDisposableLoopbackDatabase(
        "mysql://root@localhost:3306/velvet_test"
      )
    ).toBe(true);
  });

  it("rejects remote, valuable-looking, missing, and non-MySQL targets", () => {
    expect(
      isDisposableLoopbackDatabase(
        "mysql://root@example.com:3306/codex_velvet_loop"
      )
    ).toBe(false);
    expect(
      isDisposableLoopbackDatabase(
        "mysql://root@127.0.0.1:3306/velvet_production_copy"
      )
    ).toBe(false);
    expect(
      isDisposableLoopbackDatabase("mysql://root@127.0.0.1:3306")
    ).toBe(false);
    expect(
      isDisposableLoopbackDatabase(
        "postgresql://root@127.0.0.1:5432/codex_velvet_loop"
      )
    ).toBe(false);
  });

  it("does not require a database when the explicit gate is off", () => {
    expect(requireDisposableLoopbackDatabase(false)).toBe(false);
  });
});
