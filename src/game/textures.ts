import * as THREE from 'three';

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  maxAniso: number,
  isColor = true
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(8, maxAniso);
  tex.needsUpdate = true;
  return tex;
}

export interface TextureBundle {
  grass: THREE.CanvasTexture;
  road: THREE.CanvasTexture;
  stucco: THREE.CanvasTexture;
  roofTile: THREE.CanvasTexture;
  steelWall: THREE.CanvasTexture;
  crateWood: THREE.CanvasTexture;
  shadowBlob: THREE.CanvasTexture;
  signPeak: THREE.CanvasTexture;
  signFactory: THREE.CanvasTexture;
  kellyFace: THREE.CanvasTexture;
  fighterFace: THREE.CanvasTexture;
  tracksuitFabric: THREE.CanvasTexture;
  tracksuitBump: THREE.CanvasTexture;
  hairStrands: THREE.CanvasTexture;
  tacticalArmor: THREE.CanvasTexture;
  londonStone: THREE.CanvasTexture;
  londonCobble: THREE.CanvasTexture;
  londonBrick: THREE.CanvasTexture;
  bigBenClock: THREE.CanvasTexture;
  redBusSide: THREE.CanvasTexture;
  signUnderground: THREE.CanvasTexture;
  thamesWater: THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTextures(maxAniso: number): TextureBundle {
  // 1. Lush Meadow Grass
  const [gCanvas, gCtx] = makeCanvas(256, 256);
  gCtx.fillStyle = '#4e9f36';
  gCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    const x = (i * 73) % 256;
    const y = (i * 137) % 256;
    const shade = (i % 5) - 2;
    gCtx.fillStyle =
      shade > 0 ? 'rgba(130, 215, 85, 0.28)' : 'rgba(42, 108, 28, 0.28)';
    gCtx.fillRect(x, y, 3, 5);
  }
  const grass = finalizeTexture(gCanvas, 28, 28, maxAniso);

  // 2. Dirt Road (#8B7355)
  const [rCanvas, rCtx] = makeCanvas(256, 256);
  rCtx.fillStyle = '#8b7355';
  rCtx.fillRect(0, 0, 256, 256);
  rCtx.fillStyle = 'rgba(92, 72, 48, 0.25)';
  rCtx.fillRect(36, 0, 32, 256);
  rCtx.fillRect(188, 0, 32, 256);
  for (let i = 0; i < 1200; i++) {
    const x = (i * 59) % 256;
    const y = (i * 101) % 256;
    rCtx.fillStyle = i % 2 === 0 ? 'rgba(165, 142, 108, 0.35)' : 'rgba(72, 56, 38, 0.32)';
    rCtx.fillRect(x, y, 3, 3);
  }
  const road = finalizeTexture(rCanvas, 1, 16, maxAniso);

  // 3. Peak House Stucco (#FFF8DC)
  const [sCanvas, sCtx] = makeCanvas(256, 256);
  sCtx.fillStyle = '#f6edd0';
  sCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1500; i++) {
    const x = (i * 97) % 256;
    const y = (i * 43) % 256;
    sCtx.fillStyle = i % 2 === 0 ? 'rgba(218, 202, 164, 0.25)' : 'rgba(255, 255, 250, 0.25)';
    sCtx.fillRect(x, y, 4, 2);
  }
  const stucco = finalizeTexture(sCanvas, 2, 2, maxAniso);

  // 4. Terracotta Shingle Roof (#C0392B)
  const [tCanvas, tCtx] = makeCanvas(256, 256);
  tCtx.fillStyle = '#b93829';
  tCtx.fillRect(0, 0, 256, 256);
  tCtx.strokeStyle = 'rgba(75, 16, 10, 0.45)';
  tCtx.lineWidth = 3;
  for (let y = 0; y < 256; y += 32) {
    tCtx.beginPath();
    tCtx.moveTo(0, y);
    tCtx.lineTo(256, y);
    tCtx.stroke();
    const offset = (y / 32) % 2 === 0 ? 0 : 16;
    for (let x = offset; x < 256; x += 32) {
      tCtx.beginPath();
      tCtx.moveTo(x, y);
      tCtx.lineTo(x, y + 32);
      tCtx.stroke();
    }
  }
  const roofTile = finalizeTexture(tCanvas, 3, 3, maxAniso);

  // 5. Factory Corrugated Steel
  const [fCanvas, fCtx] = makeCanvas(256, 256);
  fCtx.fillStyle = '#64748b';
  fCtx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) {
    fCtx.fillStyle = 'rgba(255,255,255,0.08)';
    fCtx.fillRect(x, 0, 6, 256);
    fCtx.fillStyle = 'rgba(15,23,42,0.18)';
    fCtx.fillRect(x + 8, 0, 6, 256);
  }
  fCtx.fillStyle = '#eab308';
  fCtx.fillRect(0, 220, 256, 18);
  fCtx.fillStyle = '#1e293b';
  for (let x = -20; x < 280; x += 28) {
    fCtx.beginPath();
    fCtx.moveTo(x, 220);
    fCtx.lineTo(x + 14, 220);
    fCtx.lineTo(x + 4, 238);
    fCtx.lineTo(x - 10, 238);
    fCtx.closePath();
    fCtx.fill();
  }
  const steelWall = finalizeTexture(fCanvas, 2, 1, maxAniso);

  // 6. Tactical Wooden Crate
  const [cCanvas, cCtx] = makeCanvas(256, 256);
  cCtx.fillStyle = '#9c6b3b';
  cCtx.fillRect(0, 0, 256, 256);
  cCtx.strokeStyle = '#5c3a1b';
  cCtx.lineWidth = 18;
  cCtx.strokeRect(9, 9, 238, 238);
  cCtx.beginPath();
  cCtx.moveTo(18, 18);
  cCtx.lineTo(238, 238);
  cCtx.stroke();
  cCtx.lineWidth = 3;
  for (let y = 36; y < 220; y += 36) {
    cCtx.beginPath();
    cCtx.moveTo(18, y);
    cCtx.lineTo(238, y);
    cCtx.stroke();
  }
  const crateWood = finalizeTexture(cCanvas, 1, 1, maxAniso);

  // 7. Radial Contact Shadow Blob
  const [shCanvas, shCtx] = makeCanvas(128, 128);
  const grad = shCtx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.22)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  shCtx.fillStyle = grad;
  shCtx.fillRect(0, 0, 128, 128);
  const shadowBlob = new THREE.CanvasTexture(shCanvas);
  shadowBlob.colorSpace = THREE.SRGBColorSpace;

  // 8. Signboards ("PEAK HOUSE", "FACTORY")
  const makeSign = (label: string, bg: string, fg: string) => {
    const [canvas, ctx] = makeCanvas(512, 128);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 496, 112);
    ctx.fillStyle = fg;
    ctx.font = 'bold 54px "Chakra Petch", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 256, 66);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, maxAniso);
    return tex;
  };

  const signPeak = makeSign('PEAK HOUSE', '#1e293b', '#fef08a');
  const signFactory = makeSign('FACTORY', '#18181b', '#f87171');

  // 9. Cinematic Anime Hero Face Texture for Kelly (512x512, center u=0.5 aligned to -Z)
  const [kfCanvas, kfCtx] = makeCanvas(512, 512);
  const skinGrad = kfCtx.createRadialGradient(256, 260, 20, 256, 260, 240);
  skinGrad.addColorStop(0, '#ffe4cf');
  skinGrad.addColorStop(0.55, '#ffd1b3');
  skinGrad.addColorStop(1, '#efb38e');
  kfCtx.fillStyle = skinGrad;
  kfCtx.fillRect(0, 0, 512, 512);

  // Subsurface cheek blush + warm nose bridge glow
  for (const cx of [210, 302]) {
    const blush = kfCtx.createRadialGradient(cx, 286, 2, cx, 286, 28);
    blush.addColorStop(0, 'rgba(244, 114, 114, 0.36)');
    blush.addColorStop(1, 'rgba(244, 114, 114, 0)');
    kfCtx.fillStyle = blush;
    kfCtx.beginPath();
    kfCtx.arc(cx, 286, 28, 0, Math.PI * 2);
    kfCtx.fill();
  }

  // Subtle eye-socket ambient occlusion & upper lid shadow (3D eyes sit directly over these)
  for (const ex of [224, 288]) {
    const socket = kfCtx.createRadialGradient(ex, 248, 4, ex, 248, 24);
    socket.addColorStop(0, 'rgba(148, 86, 62, 0.28)');
    socket.addColorStop(1, 'rgba(148, 86, 62, 0)');
    kfCtx.fillStyle = socket;
    kfCtx.beginPath();
    kfCtx.arc(ex, 248, 24, 0, Math.PI * 2);
    kfCtx.fill();

    // Soft eyelid crease arc
    kfCtx.strokeStyle = 'rgba(110, 58, 42, 0.65)';
    kfCtx.lineWidth = 2.4;
    kfCtx.beginPath();
    kfCtx.arc(ex, 248, 18, Math.PI * 1.15, Math.PI * 1.85);
    kfCtx.stroke();
  }

  // Nose shadow contour + bridge highlight
  kfCtx.fillStyle = 'rgba(182, 114, 84, 0.32)';
  kfCtx.beginPath();
  kfCtx.ellipse(256, 279, 5, 3, 0, 0, Math.PI * 2);
  kfCtx.fill();
  kfCtx.fillStyle = 'rgba(255, 248, 240, 0.45)';
  kfCtx.fillRect(254, 254, 4, 18);

  // Subtle philtrum & lip shading
  const lipGrad = kfCtx.createLinearGradient(242, 298, 270, 314);
  lipGrad.addColorStop(0, '#e3807a');
  lipGrad.addColorStop(0.5, '#d96b67');
  lipGrad.addColorStop(1, '#c85a58');
  kfCtx.fillStyle = lipGrad;
  kfCtx.beginPath();
  kfCtx.moveTo(241, 303);
  kfCtx.quadraticCurveTo(256, 298, 271, 303);
  kfCtx.quadraticCurveTo(256, 313, 241, 303);
  kfCtx.fill();

  // Confident subtle smirk line
  kfCtx.strokeStyle = 'rgba(122, 46, 46, 0.78)';
  kfCtx.lineWidth = 2.1;
  kfCtx.beginPath();
  kfCtx.moveTo(240, 303);
  kfCtx.quadraticCurveTo(256, 307, 272, 301);
  kfCtx.stroke();

  // Soft chin shadow
  const chinGlow = kfCtx.createRadialGradient(256, 336, 4, 256, 336, 42);
  chinGlow.addColorStop(0, 'rgba(175, 108, 78, 0.25)');
  chinGlow.addColorStop(1, 'rgba(175, 108, 78, 0)');
  kfCtx.fillStyle = chinGlow;
  kfCtx.fillRect(200, 300, 112, 80);

  const kellyFace = new THREE.CanvasTexture(kfCanvas);
  kellyFace.colorSpace = THREE.SRGBColorSpace;
  kellyFace.anisotropy = Math.min(8, maxAniso);

  // 10. Tactical Operative Face Texture for Fighters (512x512)
  const [ffCanvas, ffCtx] = makeCanvas(512, 512);
  const fSkin = ffCtx.createRadialGradient(256, 260, 20, 256, 260, 240);
  fSkin.addColorStop(0, '#f3c6a0');
  fSkin.addColorStop(0.6, '#e2ac80');
  fSkin.addColorStop(1, '#be845a');
  ffCtx.fillStyle = fSkin;
  ffCtx.fillRect(0, 0, 512, 512);

  // Tactical cheek war-paint stripes + scar
  ffCtx.fillStyle = 'rgba(20, 26, 36, 0.62)';
  ffCtx.fillRect(202, 274, 24, 6);
  ffCtx.fillRect(286, 274, 24, 6);
  ffCtx.strokeStyle = 'rgba(145, 58, 52, 0.55)';
  ffCtx.lineWidth = 2.4;
  ffCtx.beginPath();
  ffCtx.moveTo(294, 252);
  ffCtx.lineTo(306, 282);
  ffCtx.stroke();

  // Subtle jaw stubble texture
  ffCtx.fillStyle = 'rgba(42, 34, 30, 0.14)';
  for (let i = 0; i < 420; i++) {
    const sx = 216 + ((i * 29) % 80);
    const sy = 296 + ((i * 41) % 44);
    ffCtx.fillRect(sx, sy, 1.5, 1.5);
  }
  // Mouth
  ffCtx.strokeStyle = 'rgba(92, 42, 36, 0.85)';
  ffCtx.lineWidth = 2.5;
  ffCtx.beginPath();
  ffCtx.moveTo(242, 304);
  ffCtx.lineTo(270, 304);
  ffCtx.stroke();

  const fighterFace = new THREE.CanvasTexture(ffCanvas);
  fighterFace.colorSpace = THREE.SRGBColorSpace;
  fighterFace.anisotropy = Math.min(8, maxAniso);

  // 11. Technical Yellow Tracksuit Fabric & Bump Weave
  const [tfCanvas, tfCtx] = makeCanvas(256, 256);
  const tGrad = tfCtx.createLinearGradient(0, 0, 0, 256);
  tGrad.addColorStop(0, '#fcd34d');
  tGrad.addColorStop(0.5, '#fbbf24');
  tGrad.addColorStop(1, '#d97706');
  tfCtx.fillStyle = tGrad;
  tfCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 4) {
    for (let x = 0; x < 256; x += 4) {
      const alt = ((x + y) / 4) % 2 === 0;
      tfCtx.fillStyle = alt ? 'rgba(255,255,255,0.06)' : 'rgba(120,53,15,0.06)';
      tfCtx.fillRect(x, y, 2, 2);
    }
  }
  const tracksuitFabric = finalizeTexture(tfCanvas, 3, 3, maxAniso);

  const [tbCanvas, tbCtx] = makeCanvas(256, 256);
  tbCtx.fillStyle = '#808080';
  tbCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 4) {
    for (let x = 0; x < 256; x += 4) {
      tbCtx.fillStyle = ((x + y) / 4) % 2 === 0 ? '#a8a8a8' : '#585858';
      tbCtx.fillRect(x, y, 2, 2);
    }
  }
  const tracksuitBump = finalizeTexture(tbCanvas, 4, 4, maxAniso, false);

  // 12. Anisotropic Silky Hair Strands
  const [hsCanvas, hsCtx] = makeCanvas(256, 256);
  const hGrad = hsCtx.createLinearGradient(0, 0, 0, 256);
  hGrad.addColorStop(0, '#3b1f10');
  hGrad.addColorStop(0.45, '#59321b');
  hGrad.addColorStop(0.7, '#754427');
  hGrad.addColorStop(1, '#361c0d');
  hsCtx.fillStyle = hGrad;
  hsCtx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 3) {
    hsCtx.fillStyle = x % 6 === 0 ? 'rgba(255, 224, 189, 0.12)' : 'rgba(24, 10, 4, 0.16)';
    hsCtx.fillRect(x, 0, 1.5, 256);
  }
  const hairStrands = finalizeTexture(hsCanvas, 2, 1, maxAniso);

  // 13. Ballistic Kevlar Tactical Armor Weave
  const [taCanvas, taCtx] = makeCanvas(256, 256);
  taCtx.fillStyle = '#ffffff';
  taCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 8) {
    for (let x = 0; x < 256; x += 8) {
      taCtx.fillStyle = ((x + y) / 8) % 2 === 0 ? 'rgba(255,255,255,0.95)' : 'rgba(205,212,224,0.95)';
      taCtx.fillRect(x, y, 7, 7);
    }
  }
  taCtx.strokeStyle = 'rgba(30, 41, 59, 0.22)';
  taCtx.lineWidth = 2;
  taCtx.strokeRect(4, 4, 248, 248);
  const tacticalArmor = finalizeTexture(taCanvas, 2, 2, maxAniso);

  // 14. London Westminster Limestone & Plaza Pavers
  const [lsCanvas, lsCtx] = makeCanvas(256, 256);
  lsCtx.fillStyle = '#9aa1a8';
  lsCtx.fillRect(0, 0, 256, 256);
  lsCtx.strokeStyle = 'rgba(55, 65, 81, 0.45)';
  lsCtx.lineWidth = 2;
  for (let y = 0; y < 256; y += 32) {
    lsCtx.beginPath();
    lsCtx.moveTo(0, y);
    lsCtx.lineTo(256, y);
    lsCtx.stroke();
    const offset = (y / 32) % 2 === 0 ? 0 : 16;
    for (let x = offset; x < 256; x += 32) {
      lsCtx.fillStyle = ((x + y) / 32) % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)';
      lsCtx.fillRect(x + 2, y + 2, 28, 28);
      lsCtx.beginPath();
      lsCtx.moveTo(x, y);
      lsCtx.lineTo(x, y + 32);
      lsCtx.stroke();
    }
  }
  const londonStone = finalizeTexture(lsCanvas, 20, 20, maxAniso);

  // 15. London Boulevard Tarmac + Double Yellow Lines
  const [lcCanvas, lcCtx] = makeCanvas(256, 256);
  lcCtx.fillStyle = '#2c333f';
  lcCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    const x = (i * 67) % 256;
    const y = (i * 113) % 256;
    lcCtx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.14)';
    lcCtx.fillRect(x, y, 2, 2);
  }
  lcCtx.fillStyle = '#facc15';
  lcCtx.fillRect(16, 0, 6, 256);
  lcCtx.fillRect(234, 0, 6, 256);
  lcCtx.fillStyle = '#f8fafc';
  for (let y = 0; y < 256; y += 48) {
    lcCtx.fillRect(124, y + 8, 8, 26);
  }
  const londonCobble = finalizeTexture(lcCanvas, 1, 16, maxAniso);

  // 16. Georgian London Brick Facade
  const [lbCanvas, lbCtx] = makeCanvas(256, 256);
  lbCtx.fillStyle = '#7c2d23';
  lbCtx.fillRect(0, 0, 256, 256);
  lbCtx.strokeStyle = 'rgba(226, 214, 198, 0.35)';
  lbCtx.lineWidth = 2;
  for (let y = 0; y < 256; y += 16) {
    lbCtx.beginPath();
    lbCtx.moveTo(0, y);
    lbCtx.lineTo(256, y);
    lbCtx.stroke();
    const off = (y / 16) % 2 === 0 ? 0 : 16;
    for (let x = off; x < 256; x += 32) {
      lbCtx.beginPath();
      lbCtx.moveTo(x, y);
      lbCtx.lineTo(x, y + 16);
      lbCtx.stroke();
    }
  }
  const londonBrick = finalizeTexture(lbCanvas, 3, 2, maxAniso);

  // 17. Illuminated Big Ben Clock Face
  const [bbCanvas, bbCtx] = makeCanvas(256, 256);
  bbCtx.fillStyle = '#1f2937';
  bbCtx.fillRect(0, 0, 256, 256);
  bbCtx.strokeStyle = '#fbbf24';
  bbCtx.lineWidth = 10;
  bbCtx.strokeRect(10, 10, 236, 236);
  const dialGrad = bbCtx.createRadialGradient(128, 128, 12, 128, 128, 96);
  dialGrad.addColorStop(0, '#fffbeb');
  dialGrad.addColorStop(0.85, '#fef3c7');
  dialGrad.addColorStop(1, '#d97706');
  bbCtx.fillStyle = dialGrad;
  bbCtx.beginPath();
  bbCtx.arc(128, 128, 92, 0, Math.PI * 2);
  bbCtx.fill();
  bbCtx.strokeStyle = '#1e293b';
  bbCtx.lineWidth = 5;
  bbCtx.stroke();
  for (let h = 0; h < 12; h++) {
    const ang = (h / 12) * Math.PI * 2;
    const x1 = 128 + Math.cos(ang) * 70;
    const y1 = 128 + Math.sin(ang) * 70;
    const x2 = 128 + Math.cos(ang) * 84;
    const y2 = 128 + Math.sin(ang) * 84;
    bbCtx.beginPath();
    bbCtx.moveTo(x1, y1);
    bbCtx.lineTo(x2, y2);
    bbCtx.stroke();
  }
  bbCtx.lineWidth = 7;
  bbCtx.beginPath();
  bbCtx.moveTo(128, 128);
  bbCtx.lineTo(128, 66);
  bbCtx.moveTo(128, 128);
  bbCtx.lineTo(176, 146);
  bbCtx.stroke();
  const bigBenClock = new THREE.CanvasTexture(bbCanvas);
  bigBenClock.colorSpace = THREE.SRGBColorSpace;
  bigBenClock.anisotropy = Math.min(8, maxAniso);

  // 18. Red Double-Decker Bus Side Livery
  const [rbCanvas, rbCtx] = makeCanvas(512, 256);
  rbCtx.fillStyle = '#c81e1e';
  rbCtx.fillRect(0, 0, 512, 256);
  rbCtx.fillStyle = '#f8fafc';
  rbCtx.fillRect(0, 120, 512, 14);
  rbCtx.fillStyle = '#0f172a';
  for (let wx = 26; wx < 470; wx += 74) {
    rbCtx.fillRect(wx, 24, 58, 66);
    rbCtx.fillRect(wx, 148, 58, 62);
  }
  rbCtx.fillStyle = '#fef08a';
  rbCtx.font = 'bold 20px Arial, sans-serif';
  rbCtx.fillText('LONDON · WESTMINSTER 15', 110, 114);
  const redBusSide = new THREE.CanvasTexture(rbCanvas);
  redBusSide.colorSpace = THREE.SRGBColorSpace;
  redBusSide.anisotropy = Math.min(8, maxAniso);

  // 19. London Underground Roundel
  const [ugCanvas, ugCtx] = makeCanvas(512, 256);
  ugCtx.fillStyle = '#1e293b';
  ugCtx.fillRect(0, 0, 512, 256);
  ugCtx.strokeStyle = '#dc2626';
  ugCtx.lineWidth = 28;
  ugCtx.beginPath();
  ugCtx.arc(256, 128, 76, 0, Math.PI * 2);
  ugCtx.stroke();
  ugCtx.fillStyle = '#1d4ed8';
  ugCtx.fillRect(48, 98, 416, 60);
  ugCtx.fillStyle = '#ffffff';
  ugCtx.font = 'bold 38px Arial, sans-serif';
  ugCtx.textAlign = 'center';
  ugCtx.textBaseline = 'middle';
  ugCtx.fillText('UNDERGROUND', 256, 128);
  const signUnderground = new THREE.CanvasTexture(ugCanvas);
  signUnderground.colorSpace = THREE.SRGBColorSpace;
  signUnderground.anisotropy = Math.min(8, maxAniso);

  // 20. River Thames Water Ripple
  const [twCanvas, twCtx] = makeCanvas(256, 256);
  twCtx.fillStyle = '#164e63';
  twCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 10) {
    twCtx.fillStyle = y % 20 === 0 ? 'rgba(56, 189, 248, 0.22)' : 'rgba(8, 51, 68, 0.35)';
    twCtx.fillRect(0, y, 256, 4);
  }
  const thamesWater = finalizeTexture(twCanvas, 12, 2, maxAniso);

  return {
    grass,
    road,
    stucco,
    roofTile,
    steelWall,
    crateWood,
    shadowBlob,
    signPeak,
    signFactory,
    kellyFace,
    fighterFace,
    tracksuitFabric,
    tracksuitBump,
    hairStrands,
    tacticalArmor,
    londonStone,
    londonCobble,
    londonBrick,
    bigBenClock,
    redBusSide,
    signUnderground,
    thamesWater,
    dispose: () => {
      grass.dispose();
      road.dispose();
      stucco.dispose();
      roofTile.dispose();
      steelWall.dispose();
      crateWood.dispose();
      shadowBlob.dispose();
      signPeak.dispose();
      signFactory.dispose();
      kellyFace.dispose();
      fighterFace.dispose();
      tracksuitFabric.dispose();
      tracksuitBump.dispose();
      hairStrands.dispose();
      tacticalArmor.dispose();
      londonStone.dispose();
      londonCobble.dispose();
      londonBrick.dispose();
      bigBenClock.dispose();
      redBusSide.dispose();
      signUnderground.dispose();
      thamesWater.dispose();
    },
  };
}

