declare module "occt-import-js" {
  interface OcctMeshAttribute {
    array: number[];
  }

  interface OcctMesh {
    name: string;
    color?: [number, number, number];
    attributes: {
      position: OcctMeshAttribute;
      normal?: OcctMeshAttribute;
    };
    index: {
      array: number[];
    };
  }

  interface OcctResult {
    success: boolean;
    meshes: OcctMesh[];
  }

  interface OcctInstance {
    ReadStepFile(content: Uint8Array, params: null): OcctResult;
    ReadBrepFile(content: Uint8Array, params: null): OcctResult;
    ReadIgesFile(content: Uint8Array, params: null): OcctResult;
  }

  function occtimportjs(options?: { locateFile?: (path: string) => string }): Promise<OcctInstance>;
  export default occtimportjs;
}
