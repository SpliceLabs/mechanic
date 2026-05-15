// Stubs for the `mechanic hooks` sub-program. Each verb mirrors its `skill`
// counterpart but is not yet implemented. The shape is intentionally a
// near-duplicate of src/commands/*.ts for skills so the eventual port can
// reuse registry/scope/lock helpers.

const NYI = (verb: string): never => {
  throw new Error(`\`mechanic hooks ${verb}\` is not yet implemented`);
};

export async function add(_source: string): Promise<void> {
  NYI("add");
}

export async function list(): Promise<void> {
  NYI("list");
}

export async function info(_id: string): Promise<void> {
  NYI("info");
}

export async function enable(
  _id: string,
  _opts: { scope?: string; replace?: boolean },
): Promise<void> {
  NYI("enable");
}

export async function disable(
  _id: string,
  _opts: { scope?: string },
): Promise<void> {
  NYI("disable");
}

export async function remove(_id: string): Promise<void> {
  NYI("remove");
}

export async function update(
  _id: string | undefined,
  _opts: { all?: boolean },
): Promise<void> {
  NYI("update");
}

export async function find(_source: string): Promise<void> {
  NYI("find");
}

export async function scan(
  _opts: { dir?: string; verbose?: boolean } = {},
): Promise<void> {
  NYI("scan");
}

export async function newHook(_name: string): Promise<void> {
  NYI("new");
}
