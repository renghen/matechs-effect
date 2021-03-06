import "isomorphic-fetch";
import { T, Service as F, Ex, pipe, U, O } from "@matechs/prelude";
import * as RPC from "../src";
import * as EX from "@matechs/express";
import { placeholderJsonEnv, Todo, placeholderJsonM } from "./shared";

const todos: Array<Todo> = [
  { id: 1, completed: false, title: "todo 1", userId: 1 },
  { id: 2, completed: false, title: "todo 2", userId: 2 },
  { id: 3, completed: false, title: "todo 3", userId: 3 },
  { id: 4, completed: false, title: "todo 4", userId: 1 },
  { id: 5, completed: false, title: "todo 5", userId: 2 },
  { id: 6, completed: false, title: "todo 6", userId: 3 },
  { id: 7, completed: false, title: "todo 7", userId: 4 }
];

export function authenticated<S, R, E, A>(
  eff: T.Effect<S, R, E, A>
): T.Effect<S, EX.ChildEnv & R, E | string, A> {
  return T.effect.chain(
    EX.accessReqM((req) =>
      T.condWith(req.headers["token"] === "check")(T.unit)(T.raiseError("bad token"))
    ),
    (_) => eff
  );
}

// implement the service
export const placeholderJsonLive = F.implement(placeholderJsonM)({
  [placeholderJsonEnv]: {
    getTodo: (n) =>
      pipe(
        T.trySync(() => todos[n]),
        T.chainError(() => T.raiseError("error fetching todo")),
        T.map(O.fromNullable),
        authenticated
      )
  }
});

// create a new express server
const program = pipe(
  RPC.server(placeholderJsonM, placeholderJsonLive),
  T.chain(() => EX.bind(8081)),
  EX.withApp
);

// construct live environment
const envLive: U.Env<typeof program> = {
  ...EX.express,
  [RPC.serverConfigEnv]: {
    [placeholderJsonEnv]: {
      scope: "/placeholderJson" // exposed at /placeholderJson
    }
  }
};

// run express server
T.run(
  T.provide(envLive)(program),
  Ex.fold(
    (server) => {
      // listen for exit Ctrl+C
      process.on("SIGINT", () => {
        server.close((err) => {
          process.exit(err ? 2 : 0);
        });
      });

      // listen for SIGTERM
      process.on("SIGTERM", () => {
        server.close((err) => {
          process.exit(err ? 2 : 0);
        });
      });
    },
    (e) => console.error(e),
    (e) => console.error(e),
    () => console.error("interrupted")
  )
);
