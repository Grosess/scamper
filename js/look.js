// ============================================================
//  LOOK - the whole game is flat shaded: every face is one even color (no smooth gradients across
//  curved shapes). Every "Lambert" material made anywhere becomes a flat-shaded, non-shiny one.
// ============================================================
THREE.MeshLambertMaterial = class extends THREE.MeshPhongMaterial {
  constructor(p = {}) { super(Object.assign({ flatShading: true, shininess: 0, specular: 0x000000 }, p)); }
};
