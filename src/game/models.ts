import * as THREE from 'three';
import { groundHeightAt } from './maps';
import type { TextureBundle } from './textures';
import type { MapId } from './types';
import type { WeaponModelType } from './weapons';

export { groundHeightAt };

export interface ObstacleBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
  label?: string;
}

export interface WeaponModelRig {
  group: THREE.Group;
  muzzlePoint: THREE.Object3D;
  muzzleFlash: THREE.Mesh;
}

export interface KellyRig {
  root: THREE.Group;
  hipsPivot: THREE.Group;
  torsoPivot: THREE.Group;
  leftThigh: THREE.Group;
  leftKnee: THREE.Group;
  rightThigh: THREE.Group;
  rightKnee: THREE.Group;
  leftShoulder: THREE.Group;
  rightShoulder: THREE.Group;
  weaponPivot: THREE.Group;
  m1887Group: THREE.Group;
  m1887MuzzlePoint: THREE.Object3D;
  m1887MuzzleFlash: THREE.Mesh;
  mp40Group: THREE.Group;
  mp40MuzzlePoint: THREE.Object3D;
  mp40MuzzleFlash: THREE.Mesh;
  awmGroup: THREE.Group;
  awmBolt: THREE.Group;
  awmMuzzlePoint: THREE.Object3D;
  awmMuzzleFlash: THREE.Mesh;
  weaponModels: Record<WeaponModelType, WeaponModelRig>;
  headGroup: THREE.Group;
  headAnchor: THREE.Object3D;
  shieldAura: THREE.Mesh;
  eyelids: THREE.Mesh[];
  ponytailUpper: THREE.Group;
  ponytailTip: THREE.Mesh;
}

export function createKellyModel(
  textures: TextureBundle,
  teamColor: 'gold' | 'ally' | 'enemy' | 'shadow' = 'gold'
): KellyRig {
  const root = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.65, 1.65),
    new THREE.MeshBasicMaterial({
      map: textures.shadowBlob,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);

  const shieldAura = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.72, 2.15, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color: teamColor === 'enemy' ? 0xfb7185 : teamColor === 'shadow' ? 0xa78bfa : 0x38bdf8,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  shieldAura.position.y = 1.08;
  shieldAura.visible = false;
  root.add(shieldAura);

  const headAnchor = new THREE.Object3D();
  headAnchor.position.set(0, 2.38, 0);
  root.add(headAnchor);

  const hipsPivot = new THREE.Group();
  hipsPivot.position.y = 0.92;
  root.add(hipsPivot);

  const suitTint =
    teamColor === 'ally'
      ? 0x38bdf8
      : teamColor === 'enemy'
        ? 0xf43f5e
        : teamColor === 'shadow'
          ? 0x6366f1
          : 0xffffff;
  const sheenTint =
    teamColor === 'ally'
      ? 0x7dd3fc
      : teamColor === 'enemy'
        ? 0xfda4af
        : teamColor === 'shadow'
          ? 0xc4b5fd
          : 0xfef08a;

  // Movie-grade PBR materials with fabric sheen, bump weave & clearcoat
  const yellowFabricMat = new THREE.MeshPhysicalMaterial({
    map: textures.tracksuitFabric,
    color: suitTint,
    bumpMap: textures.tracksuitBump,
    bumpScale: 0.008,
    roughness: 0.56,
    metalness: 0.04,
    sheen: 0.72,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color(sheenTint),
  });
  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.72,
    metalness: 0.1,
  });
  const darkTacticalMat = new THREE.MeshStandardMaterial({
    map: textures.tacticalArmor,
    color: 0x27272a,
    roughness: 0.62,
    metalness: 0.2,
  });
  const goldTrimMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.24,
    metalness: 0.86,
  });
  const faceSkinMat = new THREE.MeshPhysicalMaterial({
    map: textures.kellyFace,
    roughness: 0.48,
    metalness: 0.0,
    clearcoat: 0.08,
    clearcoatRoughness: 0.7,
    sheen: 0.28,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(0xff9e80),
  });
  const plainSkinMat = new THREE.MeshPhysicalMaterial({
    color: 0xffd5b8,
    roughness: 0.5,
    metalness: 0.0,
    sheen: 0.25,
    sheenColor: new THREE.Color(0xff9e80),
  });
  const hairMat = new THREE.MeshPhysicalMaterial({
    map: textures.hairStrands,
    color: 0x5c341d,
    roughness: 0.34,
    metalness: 0.14,
    clearcoat: 0.36,
    clearcoatRoughness: 0.32,
  });
  const shoeMat = new THREE.MeshPhysicalMaterial({
    color: 0xf8fafc,
    roughness: 0.36,
    metalness: 0.05,
    clearcoat: 0.25,
  });
  const soleMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.85,
  });
  const scleraMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.14,
    clearcoat: 0.9,
  });
  const irisMat = new THREE.MeshPhysicalMaterial({
    color: 0x10b981,
    emissive: 0x047857,
    emissiveIntensity: 0.26,
    roughness: 0.06,
    metalness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
  });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x090d16 });
  const catchlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lashMat = new THREE.MeshStandardMaterial({ color: 0x1c1008, roughness: 0.5 });
  const lipMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2726e,
    roughness: 0.26,
    clearcoat: 0.45,
  });

  // Articulated 2-segment legs (Thigh -> Knee -> Calf -> High-Top Sneakers)
  const makeLeg = (xOffset: number) => {
    const thighGroup = new THREE.Group();
    thighGroup.position.set(xOffset, 0, 0);

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.108, 0.28, 8, 14), yellowFabricMat);
    thigh.position.y = -0.22;
    thigh.castShadow = true;
    thighGroup.add(thigh);

    const thighStripe = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.34, 0.095), stripeMat);
    thighStripe.position.set(xOffset > 0 ? 0.102 : -0.102, -0.22, 0);
    thighGroup.add(thighStripe);

    // Drop-leg tactical holster on right thigh
    if (xOffset > 0) {
      const thighStrap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.114, 0.112, 0.055, 14),
        darkTacticalMat
      );
      thighStrap.position.y = -0.21;
      thighGroup.add(thighStrap);

      const holster = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.17, 0.11), darkTacticalMat);
      holster.position.set(0.115, -0.22, -0.01);
      holster.castShadow = true;
      thighGroup.add(holster);

      const holsterClasp = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.05), goldTrimMat);
      holsterClasp.position.set(0.116, -0.16, -0.01);
      thighGroup.add(holsterClasp);
    }

    const kneePivot = new THREE.Group();
    kneePivot.position.y = -0.44;
    thighGroup.add(kneePivot);

    const kneePad = new THREE.Mesh(new THREE.SphereGeometry(0.092, 12, 10), darkTacticalMat);
    kneePad.scale.set(0.95, 1.05, 0.72);
    kneePad.position.set(0, 0, -0.05);
    kneePivot.add(kneePad);

    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.088, 0.28, 8, 14), yellowFabricMat);
    shin.position.y = -0.22;
    shin.castShadow = true;
    kneePivot.add(shin);

    const shinStripe = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.3, 0.08), stripeMat);
    shinStripe.position.set(xOffset > 0 ? 0.086 : -0.086, -0.21, 0);
    kneePivot.add(shinStripe);

    // High-top athletic sneaker (Upper, Cuff, Tongue, Yellow Heel Accent, Sole)
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.115, 0.31), shoeMat);
    shoe.position.set(0, -0.41, -0.055);
    shoe.castShadow = true;
    kneePivot.add(shoe);

    const shoeCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.1, 0.08, 12), stripeMat);
    shoeCollar.position.set(0, -0.34, 0.01);
    kneePivot.add(shoeCollar);

    const heelAccent = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.06, 0.06), yellowFabricMat);
    heelAccent.position.set(0, -0.41, 0.08);
    kneePivot.add(heelAccent);

    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.042, 0.325), soleMat);
    sole.position.set(0, -0.46, -0.055);
    kneePivot.add(sole);

    return { thighGroup, kneePivot };
  };

  const leftLeg = makeLeg(-0.155);
  const rightLeg = makeLeg(0.155);
  hipsPivot.add(leftLeg.thighGroup, rightLeg.thighGroup);

  // Pelvis / Tactical Waist Belt + Buckle + Ammo Pouches
  const pelvis = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.22, 0.16, 16),
    darkTacticalMat
  );
  pelvis.scale.set(1.12, 1, 0.72);
  pelvis.position.y = 0.02;
  hipsPivot.add(pelvis);

  const beltBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.075, 0.04), goldTrimMat);
  beltBuckle.position.set(0, 0.03, -0.175);
  hipsPivot.add(beltBuckle);

  for (const px of [-0.23, 0.23]) {
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.11, 0.11), darkTacticalMat);
    pouch.position.set(px, 0.03, -0.03);
    hipsPivot.add(pouch);
  }

  // Articulated Upper Torso Pivot
  const torsoPivot = new THREE.Group();
  torsoPivot.position.y = 0.1;
  hipsPivot.add(torsoPivot);

  // Sculpted tapered athletic jacket torso
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.255, 0.21, 0.6, 18),
    yellowFabricMat
  );
  torso.scale.set(1.12, 1, 0.72);
  torso.position.y = 0.31;
  torso.castShadow = true;
  torso.receiveShadow = true;
  torsoPivot.add(torso);

  // Athletic shoulder pads & black racing stripes
  const chestStripeL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.56, 0.06), stripeMat);
  chestStripeL.position.set(-0.27, 0.32, 0);
  const chestStripeR = chestStripeL.clone();
  chestStripeR.position.x = 0.27;
  torsoPivot.add(chestStripeL, chestStripeR);

  // Front central zipper track & gold pull
  const zipperTrack = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.56, 0.02), stripeMat);
  zipperTrack.position.set(0, 0.32, -0.184);
  torsoPivot.add(zipperTrack);

  const zipperPull = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.055, 0.025), goldTrimMat);
  zipperPull.position.set(0, 0.55, -0.194);
  torsoPivot.add(zipperPull);

  // Golden Wing/Crest Emblem on Chest
  const chestEmblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), goldTrimMat);
  chestEmblem.scale.set(1.2, 1, 0.4);
  chestEmblem.position.set(-0.12, 0.45, -0.185);
  torsoPivot.add(chestEmblem);

  // High athletic stand-up collar
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.175, 0.13, 16), stripeMat);
  collar.position.set(0, 0.64, 0);
  torsoPivot.add(collar);

  const collarRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.145, 0.016, 8, 18),
    yellowFabricMat
  );
  collarRim.rotation.x = Math.PI / 2;
  collarRim.position.set(0, 0.7, 0);
  torsoPivot.add(collarRim);

  // Back stripe + Multi-part Tactical Backpack
  const backStripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.03), stripeMat);
  backStripe.position.set(0, 0.32, 0.17);
  torsoPivot.add(backStripe);

  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.38, 0.16), darkTacticalMat);
  pack.position.set(0, 0.34, 0.23);
  pack.castShadow = true;
  torsoPivot.add(pack);

  const packLowerPocket = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.15, 0.06), stripeMat);
  packLowerPocket.position.set(0, 0.23, 0.32);
  torsoPivot.add(packLowerPocket);

  const packTrim = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.065, 0.17), goldTrimMat);
  packTrim.position.set(0, 0.45, 0.23);
  torsoPivot.add(packTrim);

  // Neck bridging collar & sculpted head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.084, 0.16, 14), plainSkinMat);
  neck.position.set(0, 0.71, -0.01);
  torsoPivot.add(neck);

  // =========================================================================
  // MOVIE-GRADE SCULPTED HEAD, FACE, 3D EYES, LASHES, NOSE, LIPS & ANIME HAIR
  // =========================================================================
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.87, -0.01);
  torsoPivot.add(headGroup);

  // Main cranium UV-mapped so u=0.5 faces directly forward (-Z)
  const headGeo = new THREE.SphereGeometry(0.205, 28, 24, Math.PI * 0.5, Math.PI * 2);
  const head = new THREE.Mesh(headGeo, faceSkinMat);
  head.scale.set(0.95, 1.06, 0.96);
  head.castShadow = true;
  headGroup.add(head);

  // Tapered anime jawline / chin contour
  const chin = new THREE.Mesh(new THREE.SphereGeometry(0.145, 18, 14), plainSkinMat);
  chin.scale.set(0.76, 0.58, 0.72);
  chin.position.set(0, -0.105, -0.055);
  headGroup.add(chin);

  // Sculpted Ears (Left & Right)
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.04, 6, 10), plainSkinMat);
    ear.scale.set(0.55, 1.0, 0.75);
    ear.position.set(side * 0.192, -0.01, 0.01);
    ear.rotation.z = side * 0.14;
    headGroup.add(ear);
  }

  // 3D Sculpted Anime Eyes (Sclera + Clearcoated Emerald Iris + Pupil + Dual Catchlights + Upper Lashes + Blink Lid)
  const eyelids: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const eyeSocket = new THREE.Group();
    eyeSocket.position.set(side * 0.068, 0.01, -0.172);
    eyeSocket.rotation.y = -side * 0.16;
    headGroup.add(eyeSocket);

    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.036, 14, 12), scleraMat);
    sclera.scale.set(1.06, 0.82, 0.42);
    eyeSocket.add(sclera);

    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.024, 14, 12), irisMat);
    iris.scale.set(0.92, 1.02, 0.36);
    iris.position.set(-side * 0.002, 0, -0.01);
    eyeSocket.add(iris);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 10), pupilMat);
    pupil.scale.set(0.9, 1.0, 0.36);
    pupil.position.set(-side * 0.002, -0.001, -0.016);
    eyeSocket.add(pupil);

    // Dual crisp anime specular catchlights
    const catchTop = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 8, 8), catchlightMat);
    catchTop.position.set(0.009, 0.009, -0.021);
    const catchBot = new THREE.Mesh(new THREE.SphereGeometry(0.0032, 6, 6), catchlightMat);
    catchBot.position.set(-0.008, -0.008, -0.02);
    eyeSocket.add(catchTop, catchBot);

    // Curved dark upper eyelash line
    const lash = new THREE.Mesh(
      new THREE.TorusGeometry(0.038, 0.0065, 6, 14, Math.PI * 0.85),
      lashMat
    );
    lash.rotation.z = Math.PI * 0.08;
    lash.position.set(0, 0.002, -0.008);
    eyeSocket.add(lash);

    // Blinking skin eyelid (scales Y down on blink)
    const lid = new THREE.Mesh(
      new THREE.SphereGeometry(0.038, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
      plainSkinMat
    );
    lid.scale.set(1.08, 0.08, 0.46);
    lid.position.set(0, 0.026, -0.004);
    eyeSocket.add(lid);
    eyelids.push(lid);

    // Determined arched 3D eyebrow
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.011, 0.016), lashMat);
    brow.position.set(side * 0.072, 0.062, -0.18);
    brow.rotation.z = side * 0.14;
    brow.rotation.y = -side * 0.18;
    headGroup.add(brow);
  }

  // Sculpted 3D Nose Bridge & Tip
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.04, 8), plainSkinMat);
  nose.rotation.x = -Math.PI * 0.42;
  nose.position.set(0, -0.028, -0.198);
  headGroup.add(nose);

  // Expressive 3D Lips
  const lips = new THREE.Mesh(new THREE.CapsuleGeometry(0.0085, 0.032, 6, 10), lipMat);
  lips.rotation.z = Math.PI / 2;
  lips.position.set(0, -0.086, -0.182);
  headGroup.add(lips);

  // Volumetric Layered Anime Hair (Crown + Swept Bangs + Cheek Locks + Headband + 3-Segment Ponytail)
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.222, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.62),
    hairMat
  );
  hairCap.rotation.x = 0.26;
  hairCap.position.set(0, 0.025, 0.022);
  hairCap.castShadow = true;
  headGroup.add(hairCap);

  // Swept front hair bangs (framing forehead & temples without blocking eyes)
  const bangConfigs: Array<[number, number, number, number, number, number, number]> = [
    [-0.12, 0.135, -0.14, 0.38, 0.18, 0.45, 0.17],
    [-0.055, 0.145, -0.17, 0.42, 0.08, 0.25, 0.15],
    [0.01, 0.15, -0.175, 0.45, -0.06, -0.18, 0.14],
    [0.075, 0.142, -0.165, 0.42, -0.14, -0.32, 0.155],
    [0.13, 0.13, -0.135, 0.36, -0.22, -0.46, 0.17],
  ];
  for (const [bx, by, bz, rx, ry, rz, len] of bangConfigs) {
    const bang = new THREE.Mesh(new THREE.ConeGeometry(0.044, len, 8), hairMat);
    bang.position.set(bx, by, bz);
    bang.rotation.set(Math.PI + rx, ry, rz);
    bang.castShadow = true;
    headGroup.add(bang);
  }

  // Side cheek hair locks
  for (const side of [-1, 1]) {
    const sideLock = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.24, 8), hairMat);
    sideLock.position.set(side * 0.175, -0.02, -0.085);
    sideLock.rotation.set(Math.PI + 0.12, 0, side * 0.15);
    headGroup.add(sideLock);
  }

  // Signature Yellow Athletic Headband with Gold Side Clasp
  const headband = new THREE.Mesh(
    new THREE.TorusGeometry(0.214, 0.024, 10, 26),
    yellowFabricMat
  );
  headband.rotation.x = Math.PI / 2 - 0.16;
  headband.position.set(0, 0.085, 0.008);
  headGroup.add(headband);

  const headbandClip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.036, 0.055), goldTrimMat);
  headbandClip.position.set(0.205, 0.085, -0.04);
  headGroup.add(headbandClip);

  // Articulated 3-part High Ponytail
  const ponytailUpper = new THREE.Group();
  ponytailUpper.position.set(0, 0.055, 0.21);
  headGroup.add(ponytailUpper);

  const hairTie = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.016, 8, 16), goldTrimMat);
  hairTie.rotation.x = Math.PI * 0.25;
  ponytailUpper.add(hairTie);

  const pBase = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.2, 8, 12), hairMat);
  pBase.position.set(0, -0.065, 0.095);
  pBase.rotation.x = 0.85;
  pBase.castShadow = true;
  ponytailUpper.add(pBase);

  const ponytailTip = new THREE.Mesh(new THREE.ConeGeometry(0.066, 0.28, 10), hairMat);
  ponytailTip.position.set(0, -0.2, 0.22);
  ponytailTip.rotation.x = 2.42;
  ponytailTip.castShadow = true;
  ponytailUpper.add(ponytailTip);

  // Articulated Arms + Cuffed Sleeves + Fingerless Tactical Gloves
  const leftShoulder = new THREE.Group();
  leftShoulder.position.set(-0.33, 0.54, 0);
  const leftArmMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.074, 0.42, 8, 12), yellowFabricMat);
  leftArmMesh.position.set(0.06, -0.16, -0.18);
  leftArmMesh.rotation.set(Math.PI / 2.8, 0, -0.25);
  leftArmMesh.castShadow = true;
  leftShoulder.add(leftArmMesh);
  const leftCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.068, 0.06, 10), stripeMat);
  leftCuff.position.set(0.14, -0.23, -0.33);
  leftCuff.rotation.x = Math.PI / 2.8;
  leftShoulder.add(leftCuff);
  const leftGlove = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 10), darkTacticalMat);
  leftGlove.position.set(0.16, -0.26, -0.38);
  leftShoulder.add(leftGlove);
  torsoPivot.add(leftShoulder);

  const rightShoulder = new THREE.Group();
  rightShoulder.position.set(0.33, 0.54, 0);
  const rightArmMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.074, 0.42, 8, 12), yellowFabricMat);
  rightArmMesh.position.set(-0.03, -0.16, -0.18);
  rightArmMesh.rotation.set(Math.PI / 2.6, 0, 0.14);
  rightArmMesh.castShadow = true;
  rightShoulder.add(rightArmMesh);
  const rightCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.068, 0.06, 10), stripeMat);
  rightCuff.position.set(-0.04, -0.23, -0.33);
  rightCuff.rotation.x = Math.PI / 2.6;
  rightShoulder.add(rightCuff);
  const rightGlove = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 10), darkTacticalMat);
  rightGlove.position.set(-0.05, -0.26, -0.38);
  rightShoulder.add(rightGlove);
  torsoPivot.add(rightShoulder);

  // Weapon Pivot attached to Upper Torso
  const weaponPivot = new THREE.Group();
  weaponPivot.position.set(0.26, 0.3, -0.34);
  torsoPivot.add(weaponPivot);

  const gunMetalMat = new THREE.MeshStandardMaterial({
    color: 0x2a313c,
    roughness: 0.24,
    metalness: 0.9,
  });
  const darkBarrelMat = new THREE.MeshStandardMaterial({
    color: 0x11151b,
    roughness: 0.18,
    metalness: 0.94,
  });
  const walnutMat = new THREE.MeshStandardMaterial({
    color: 0x6b3e26,
    roughness: 0.58,
    metalness: 0.05,
  });
  const oliveChassisMat = new THREE.MeshStandardMaterial({
    color: 0x3f4d38,
    roughness: 0.52,
    metalness: 0.22,
  });
  const scopeLensMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    roughness: 0.04,
    metalness: 0.1,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
  });

  // 1. M1887 Shotgun
  const m1887Group = new THREE.Group();
  weaponPivot.add(m1887Group);

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.105, 0.34), gunMetalMat);
  receiver.castShadow = true;
  m1887Group.add(receiver);

  const upperBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.68, 12), darkBarrelMat);
  upperBarrel.rotation.x = Math.PI / 2;
  upperBarrel.position.set(0, 0.03, -0.45);
  upperBarrel.castShadow = true;
  m1887Group.add(upperBarrel);

  const magTube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.58, 10), gunMetalMat);
  magTube.rotation.x = Math.PI / 2;
  magTube.position.set(0, -0.014, -0.4);
  m1887Group.add(magTube);

  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.125, 0.24), walnutMat);
  stock.position.set(0, -0.05, 0.22);
  stock.rotation.x = 0.24;
  m1887Group.add(stock);

  const lever = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.009, 6, 12), goldTrimMat);
  lever.rotation.y = Math.PI / 2;
  lever.position.set(0, -0.075, 0.03);
  m1887Group.add(lever);

  const m1887MuzzlePoint = new THREE.Object3D();
  m1887MuzzlePoint.position.set(0, 0.03, -0.82);
  m1887Group.add(m1887MuzzlePoint);

  const m1887MuzzleFlash = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.44, 6),
    new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.95 })
  );
  m1887MuzzleFlash.rotation.x = -Math.PI / 2;
  m1887MuzzleFlash.position.set(0, 0.03, -0.96);
  m1887MuzzleFlash.visible = false;
  m1887Group.add(m1887MuzzleFlash);

  // 2. MP40 Rush SMG
  const mp40Group = new THREE.Group();
  mp40Group.visible = false;
  weaponPivot.add(mp40Group);

  const mp40Body = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.036, 0.44, 12), gunMetalMat);
  mp40Body.rotation.x = Math.PI / 2;
  mp40Body.position.set(0, 0.02, -0.04);
  mp40Group.add(mp40Body);

  const mp40Barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.017, 0.34, 10), darkBarrelMat);
  mp40Barrel.rotation.x = Math.PI / 2;
  mp40Barrel.position.set(0, 0.024, -0.4);
  mp40Group.add(mp40Barrel);

  const mp40StickMag = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.25, 0.044), darkBarrelMat);
  mp40StickMag.position.set(0, -0.13, -0.18);
  mp40StickMag.rotation.x = -0.1;
  mp40Group.add(mp40StickMag);

  const mp40Grip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.13, 0.05), walnutMat);
  mp40Grip.position.set(0, -0.07, 0.09);
  mp40Grip.rotation.x = 0.22;
  mp40Group.add(mp40Grip);

  const mp40FoldStock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.28), goldTrimMat);
  mp40FoldStock.position.set(0, -0.018, 0.04);
  mp40Group.add(mp40FoldStock);

  const mp40MuzzlePoint = new THREE.Object3D();
  mp40MuzzlePoint.position.set(0, 0.024, -0.58);
  mp40Group.add(mp40MuzzlePoint);

  const mp40MuzzleFlash = new THREE.Mesh(
    new THREE.ConeGeometry(0.11, 0.28, 6),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.95 })
  );
  mp40MuzzleFlash.rotation.x = -Math.PI / 2;
  mp40MuzzleFlash.position.set(0, 0.024, -0.7);
  mp40MuzzleFlash.visible = false;
  mp40Group.add(mp40MuzzleFlash);

  // 3. AWM Bolt-Action Sniper Rifle
  const awmGroup = new THREE.Group();
  awmGroup.visible = false;
  weaponPivot.add(awmGroup);

  const awmChassis = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.11, 0.62), oliveChassisMat);
  awmChassis.position.set(0, -0.01, -0.04);
  awmChassis.castShadow = true;
  awmGroup.add(awmChassis);

  const awmStock = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.125, 0.28), oliveChassisMat);
  awmStock.position.set(0, -0.04, 0.28);
  awmGroup.add(awmStock);

  const awmBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.023, 0.88, 12), darkBarrelMat);
  awmBarrel.rotation.x = Math.PI / 2;
  awmBarrel.position.set(0, 0.03, -0.66);
  awmBarrel.castShadow = true;
  awmGroup.add(awmBarrel);

  const awmMuzzleBrake = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.046, 0.09), gunMetalMat);
  awmMuzzleBrake.position.set(0, 0.03, -1.12);
  awmGroup.add(awmMuzzleBrake);

  const awmMag = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.14, 0.09), darkBarrelMat);
  awmMag.position.set(0, -0.1, -0.08);
  awmGroup.add(awmMag);

  const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.022, 0.34, 12), darkBarrelMat);
  scopeTube.rotation.x = Math.PI / 2;
  scopeTube.position.set(0, 0.105, -0.08);
  awmGroup.add(scopeTube);

  const scopeBell = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.026, 0.09, 12), gunMetalMat);
  scopeBell.rotation.x = Math.PI / 2;
  scopeBell.position.set(0, 0.105, -0.26);
  awmGroup.add(scopeBell);

  const scopeLens = new THREE.Mesh(new THREE.CircleGeometry(0.031, 12), scopeLensMat);
  scopeLens.position.set(0, 0.105, -0.306);
  scopeLens.rotation.y = Math.PI;
  awmGroup.add(scopeLens);

  const awmBolt = new THREE.Group();
  awmBolt.position.set(0.035, 0.045, 0.06);
  const boltStem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 6), goldTrimMat);
  boltStem.rotation.z = Math.PI / 2;
  boltStem.position.x = 0.025;
  const boltKnob = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 8), darkBarrelMat);
  boltKnob.position.x = 0.055;
  awmBolt.add(boltStem, boltKnob);
  awmGroup.add(awmBolt);

  const awmMuzzlePoint = new THREE.Object3D();
  awmMuzzlePoint.position.set(0, 0.03, -1.18);
  awmGroup.add(awmMuzzlePoint);

  const awmMuzzleFlash = new THREE.Mesh(
    new THREE.ConeGeometry(0.2, 0.56, 6),
    new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.96 })
  );
  awmMuzzleFlash.rotation.x = -Math.PI / 2;
  awmMuzzleFlash.position.set(0, 0.03, -1.38);
  awmMuzzleFlash.visible = false;
  awmGroup.add(awmMuzzleFlash);

  // 4. AK-47 / Groza Kalashnikov Archetype (Wood Stock + Curved Banana Mag)
  const ak47Group = new THREE.Group();
  ak47Group.visible = false;
  weaponPivot.add(ak47Group);

  const akReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.1, 0.42), gunMetalMat);
  akReceiver.position.set(0, 0.01, -0.04);
  akReceiver.castShadow = true;
  ak47Group.add(akReceiver);

  const akHandguard = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.08, 0.24), walnutMat);
  akHandguard.position.set(0, 0.012, -0.34);
  ak47Group.add(akHandguard);

  const akStock = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.115, 0.26), walnutMat);
  akStock.position.set(0, -0.03, 0.26);
  akStock.rotation.x = 0.12;
  ak47Group.add(akStock);

  const akBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.019, 0.42, 10), darkBarrelMat);
  akBarrel.rotation.x = Math.PI / 2;
  akBarrel.position.set(0, 0.025, -0.58);
  ak47Group.add(akBarrel);

  const akBananaMag = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.24, 0.068), darkBarrelMat);
  akBananaMag.position.set(0, -0.14, -0.2);
  akBananaMag.rotation.x = -0.32;
  ak47Group.add(akBananaMag);

  const akMuzzlePoint = new THREE.Object3D();
  akMuzzlePoint.position.set(0, 0.025, -0.82);
  ak47Group.add(akMuzzlePoint);

  const akMuzzleFlash = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.36, 6),
    new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.95 })
  );
  akMuzzleFlash.rotation.x = -Math.PI / 2;
  akMuzzleFlash.position.set(0, 0.025, -0.96);
  akMuzzleFlash.visible = false;
  ak47Group.add(akMuzzleFlash);

  // 5. Tactical Assault Rifle (M4A1 / SCAR-L / AUG / FAMAS / AA-12)
  const arGroup = new THREE.Group();
  arGroup.visible = false;
  weaponPivot.add(arGroup);

  const arUpper = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.105, 0.48), gunMetalMat);
  arUpper.position.set(0, 0.012, -0.08);
  arUpper.castShadow = true;
  arGroup.add(arUpper);

  const arStock = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.115, 0.24), darkBarrelMat);
  arStock.position.set(0, -0.012, 0.25);
  arGroup.add(arStock);

  const arBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.02, 0.44, 10), darkBarrelMat);
  arBarrel.rotation.x = Math.PI / 2;
  arBarrel.position.set(0, 0.024, -0.5);
  arGroup.add(arBarrel);

  const arHoloSight = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.048, 0.085), darkBarrelMat);
  arHoloSight.position.set(0, 0.085, -0.06);
  arGroup.add(arHoloSight);

  const arSightLens = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.028), scopeLensMat);
  arSightLens.position.set(0, 0.086, -0.105);
  arSightLens.rotation.y = Math.PI;
  arGroup.add(arSightLens);

  const arMag = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.2, 0.068), darkBarrelMat);
  arMag.position.set(0, -0.115, -0.18);
  arMag.rotation.x = -0.14;
  arGroup.add(arMag);

  const arMuzzlePoint = new THREE.Object3D();
  arMuzzlePoint.position.set(0, 0.024, -0.74);
  arGroup.add(arMuzzlePoint);

  const arMuzzleFlash = new THREE.Mesh(
    new THREE.ConeGeometry(0.13, 0.34, 6),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.95 })
  );
  arMuzzleFlash.rotation.x = -Math.PI / 2;
  arMuzzleFlash.position.set(0, 0.024, -0.88);
  arMuzzleFlash.visible = false;
  arGroup.add(arMuzzleFlash);

  // 6. Heavy Belt-Fed LMG (M249 SAW / PKP Pecheneg)
  const lmgGroup = new THREE.Group();
  lmgGroup.visible = false;
  weaponPivot.add(lmgGroup);

  const lmgBody = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.125, 0.56), oliveChassisMat);
  lmgBody.position.set(0, 0.015, -0.1);
  lmgBody.castShadow = true;
  lmgGroup.add(lmgBody);

  const lmgBoxMag = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.17, 0.16), oliveChassisMat);
  lmgBoxMag.position.set(-0.02, -0.12, -0.14);
  lmgGroup.add(lmgBoxMag);

  const lmgStock = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.12, 0.25), darkBarrelMat);
  lmgStock.position.set(0, -0.01, 0.26);
  lmgGroup.add(lmgStock);

  const lmgBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.024, 0.54, 12), darkBarrelMat);
  lmgBarrel.rotation.x = Math.PI / 2;
  lmgBarrel.position.set(0, 0.032, -0.62);
  lmgGroup.add(lmgBarrel);

  const lmgBipodL = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 6), gunMetalMat);
  lmgBipodL.position.set(-0.045, -0.07, -0.58);
  lmgBipodL.rotation.z = 0.28;
  const lmgBipodR = lmgBipodL.clone();
  lmgBipodR.position.x = 0.045;
  lmgBipodR.rotation.z = -0.28;
  lmgGroup.add(lmgBipodL, lmgBipodR);

  const lmgMuzzlePoint = new THREE.Object3D();
  lmgMuzzlePoint.position.set(0, 0.032, -0.92);
  lmgGroup.add(lmgMuzzlePoint);

  const lmgMuzzleFlash = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.42, 6),
    new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.95 })
  );
  lmgMuzzleFlash.rotation.x = -Math.PI / 2;
  lmgMuzzleFlash.position.set(0, 0.032, -1.08);
  lmgMuzzleFlash.visible = false;
  lmgGroup.add(lmgMuzzleFlash);

  // 7. Sidearm Pistol (Desert Eagle / Glock 18)
  const pistolGroup = new THREE.Group();
  pistolGroup.visible = false;
  weaponPivot.add(pistolGroup);

  const pistolSlide = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.056, 0.26), goldTrimMat);
  pistolSlide.position.set(0, 0.04, -0.14);
  pistolSlide.castShadow = true;
  pistolGroup.add(pistolSlide);

  const pistolFrame = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.038, 0.24), darkBarrelMat);
  pistolFrame.position.set(0, 0.004, -0.13);
  pistolGroup.add(pistolFrame);

  const pistolGrip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.13, 0.052), darkBarrelMat);
  pistolGrip.position.set(0, -0.06, -0.02);
  pistolGrip.rotation.x = 0.24;
  pistolGroup.add(pistolGrip);

  const pistolMuzzlePoint = new THREE.Object3D();
  pistolMuzzlePoint.position.set(0, 0.035, -0.3);
  pistolGroup.add(pistolMuzzlePoint);

  const pistolMuzzleFlash = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.24, 6),
    new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.95 })
  );
  pistolMuzzleFlash.rotation.x = -Math.PI / 2;
  pistolMuzzleFlash.position.set(0, 0.035, -0.4);
  pistolMuzzleFlash.visible = false;
  pistolGroup.add(pistolMuzzleFlash);

  // 8. Heavy Launcher (RPG-7)
  const rpgGroup = new THREE.Group();
  rpgGroup.visible = false;
  weaponPivot.add(rpgGroup);

  const rpgTube = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.048, 1.05, 14), oliveChassisMat);
  rpgTube.rotation.x = Math.PI / 2;
  rpgTube.position.set(0, 0.06, -0.1);
  rpgTube.castShadow = true;
  rpgGroup.add(rpgTube);

  const rpgWoodShield = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.054, 0.34, 14), walnutMat);
  rpgWoodShield.rotation.x = Math.PI / 2;
  rpgWoodShield.position.set(0, 0.06, -0.08);
  rpgGroup.add(rpgWoodShield);

  const rpgWarheadCone = new THREE.Mesh(new THREE.ConeGeometry(0.082, 0.26, 12), oliveChassisMat);
  rpgWarheadCone.rotation.x = -Math.PI / 2;
  rpgWarheadCone.position.set(0, 0.06, -0.74);
  rpgGroup.add(rpgWarheadCone);

  const rpgMuzzlePoint = new THREE.Object3D();
  rpgMuzzlePoint.position.set(0, 0.06, -0.88);
  rpgGroup.add(rpgMuzzlePoint);

  const rpgMuzzleFlash = new THREE.Mesh(
    new THREE.ConeGeometry(0.24, 0.62, 6),
    new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.96 })
  );
  rpgMuzzleFlash.rotation.x = -Math.PI / 2;
  rpgMuzzleFlash.position.set(0, 0.06, -1.08);
  rpgMuzzleFlash.visible = false;
  rpgGroup.add(rpgMuzzleFlash);

  const weaponModels: Record<WeaponModelType, WeaponModelRig> = {
    m1887: { group: m1887Group, muzzlePoint: m1887MuzzlePoint, muzzleFlash: m1887MuzzleFlash },
    mp40: { group: mp40Group, muzzlePoint: mp40MuzzlePoint, muzzleFlash: mp40MuzzleFlash },
    awm: { group: awmGroup, muzzlePoint: awmMuzzlePoint, muzzleFlash: awmMuzzleFlash },
    ak47: { group: ak47Group, muzzlePoint: akMuzzlePoint, muzzleFlash: akMuzzleFlash },
    ar: { group: arGroup, muzzlePoint: arMuzzlePoint, muzzleFlash: arMuzzleFlash },
    lmg: { group: lmgGroup, muzzlePoint: lmgMuzzlePoint, muzzleFlash: lmgMuzzleFlash },
    pistol: { group: pistolGroup, muzzlePoint: pistolMuzzlePoint, muzzleFlash: pistolMuzzleFlash },
    rpg: { group: rpgGroup, muzzlePoint: rpgMuzzlePoint, muzzleFlash: rpgMuzzleFlash },
  };

  return {
    root,
    hipsPivot,
    torsoPivot,
    leftThigh: leftLeg.thighGroup,
    leftKnee: leftLeg.kneePivot,
    rightThigh: rightLeg.thighGroup,
    rightKnee: rightLeg.kneePivot,
    leftShoulder,
    rightShoulder,
    weaponPivot,
    m1887Group,
    m1887MuzzlePoint,
    m1887MuzzleFlash,
    mp40Group,
    mp40MuzzlePoint,
    mp40MuzzleFlash,
    awmGroup,
    awmBolt,
    awmMuzzlePoint,
    awmMuzzleFlash,
    weaponModels,
    headGroup,
    headAnchor,
    shieldAura,
    eyelids,
    ponytailUpper,
    ponytailTip,
  };
}

export interface FighterRig {
  root: THREE.Group;
  hipsPivot: THREE.Group;
  torsoPivot: THREE.Group;
  leftThigh: THREE.Group;
  leftKnee: THREE.Group;
  rightThigh: THREE.Group;
  rightKnee: THREE.Group;
  headAnchor: THREE.Object3D;
  shieldAura: THREE.Mesh;
  muzzlePoint: THREE.Object3D;
  muzzleFlash: THREE.Mesh;
  armorMeshes: THREE.Mesh[];
}

export function createFighterModel(
  textures: TextureBundle,
  team: 'enemy' | 'ally',
  isBoss = false
): FighterRig {
  const root = new THREE.Group();
  if (isBoss) root.scale.setScalar(1.08);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.5),
    new THREE.MeshBasicMaterial({
      map: textures.shadowBlob,
      transparent: true,
      depthWrite: false,
      opacity: 0.5,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);

  const shieldAura = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.7, 2.1, 18, 1, true),
    new THREE.MeshBasicMaterial({
      color: team === 'enemy' ? 0xfb7185 : 0x38bdf8,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  shieldAura.position.y = 1.05;
  shieldAura.visible = false;
  root.add(shieldAura);

  const hipsPivot = new THREE.Group();
  hipsPivot.position.y = 0.9;
  root.add(hipsPivot);

  const armorMat = new THREE.MeshPhysicalMaterial({
    map: textures.tacticalArmor,
    color: team === 'enemy' ? (isBoss ? 0x991b1b : 0xdc2626) : 0x2563eb,
    roughness: 0.4,
    metalness: 0.32,
    clearcoat: 0.25,
  });
  const darkGearMat = new THREE.MeshStandardMaterial({
    map: textures.tacticalArmor,
    color: 0x1e293b,
    roughness: 0.65,
    metalness: 0.28,
  });
  const visorMat = new THREE.MeshPhysicalMaterial({
    color: team === 'enemy' ? 0xf97316 : 0x38bdf8,
    roughness: 0.08,
    metalness: 0.25,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.52,
  });
  const faceMat = new THREE.MeshPhysicalMaterial({
    map: textures.fighterFace,
    roughness: 0.54,
    sheen: 0.2,
    sheenColor: new THREE.Color(0xffa07a),
  });
  const skinPlainMat = new THREE.MeshStandardMaterial({
    color: 0xe6b288,
    roughness: 0.58,
  });
  const scleraMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
  const eyeMat = new THREE.MeshBasicMaterial({
    color: team === 'enemy' ? 0xfbbf24 : 0x38bdf8,
  });
  const browMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.6 });

  const armorMeshes: THREE.Mesh[] = [];

  const makeLeg = (xOffset: number) => {
    const thighGroup = new THREE.Group();
    thighGroup.position.set(xOffset, 0, 0);

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.28, 6, 10), darkGearMat);
    thigh.position.y = -0.22;
    thigh.castShadow = true;
    thighGroup.add(thigh);

    const kneePivot = new THREE.Group();
    kneePivot.position.y = -0.42;
    thighGroup.add(kneePivot);

    const kneeGuard = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.13, 0.06), armorMat);
    kneeGuard.position.set(0, 0, -0.085);
    kneePivot.add(kneeGuard);
    armorMeshes.push(kneeGuard);

    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.088, 0.28, 6, 10), darkGearMat);
    shin.position.y = -0.22;
    shin.castShadow = true;
    kneePivot.add(shin);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.14, 0.3), armorMat);
    boot.position.set(0, -0.41, -0.04);
    kneePivot.add(boot);
    armorMeshes.push(boot);

    return { thighGroup, kneePivot };
  };

  const leftLeg = makeLeg(-0.155);
  const rightLeg = makeLeg(0.155);
  hipsPivot.add(leftLeg.thighGroup, rightLeg.thighGroup);

  const torsoPivot = new THREE.Group();
  torsoPivot.position.y = 0.08;
  hipsPivot.add(torsoPivot);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.62, 14), armorMat);
  torso.scale.set(1.12, 1, 0.76);
  torso.position.y = 0.32;
  torso.castShadow = true;
  torso.receiveShadow = true;
  torsoPivot.add(torso);
  armorMeshes.push(torso);

  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.44, 0.38), darkGearMat);
  vest.position.y = 0.35;
  torsoPivot.add(vest);

  // Shoulder pauldrons
  for (const sx of [-0.32, 0.32]) {
    const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 8), armorMat);
    pauldron.scale.set(0.95, 0.75, 1.0);
    pauldron.position.set(sx, 0.56, 0);
    torsoPivot.add(pauldron);
    armorMeshes.push(pauldron);
  }

  // Sculpted Fighter Head with Visible Face, 3D Eyes, Brows, Nose, Ears & Translucent Tactical Visor
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 20, 18, Math.PI * 0.5, Math.PI * 2),
    faceMat
  );
  head.scale.set(0.96, 1.05, 0.96);
  head.position.y = 0.86;
  head.castShadow = true;
  torsoPivot.add(head);

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.024, 0.036, 5, 8), skinPlainMat);
    ear.scale.set(0.55, 1, 0.75);
    ear.position.set(side * 0.19, 0.85, 0.01);
    torsoPivot.add(ear);

    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), scleraMat);
    sclera.scale.set(1.05, 0.75, 0.4);
    sclera.position.set(side * 0.068, 0.87, -0.172);
    torsoPivot.add(sclera);

    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), eyeMat);
    iris.scale.set(1, 1, 0.4);
    iris.position.set(side * 0.068, 0.87, -0.181);
    torsoPivot.add(iris);

    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.013, 0.016), browMat);
    brow.position.set(side * 0.07, 0.92, -0.178);
    brow.rotation.z = -side * 0.18;
    torsoPivot.add(brow);
  }

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.044, 6), skinPlainMat);
  nose.rotation.x = -Math.PI * 0.42;
  nose.position.set(0, 0.835, -0.195);
  torsoPivot.add(nose);

  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.224, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
    armorMat
  );
  helmet.rotation.x = 0.2;
  helmet.position.set(0, 0.885, 0.015);
  torsoPivot.add(helmet);
  armorMeshes.push(helmet);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.085, 0.12), visorMat);
  visor.position.set(0, 0.875, -0.16);
  torsoPivot.add(visor);

  const rightArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.078, 0.4, 6, 10), armorMat);
  rightArm.position.set(0.32, 0.36, -0.16);
  rightArm.rotation.x = Math.PI / 2.4;
  torsoPivot.add(rightArm);
  armorMeshes.push(rightArm);

  const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.074, 0.38, 6, 10), armorMat);
  leftArm.position.set(-0.22, 0.34, -0.22);
  leftArm.rotation.set(Math.PI / 2.5, 0, -0.42);
  torsoPivot.add(leftArm);
  armorMeshes.push(leftArm);

  const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.095, 0.76), darkGearMat);
  rifle.position.set(0.26, 0.31, -0.45);
  rifle.castShadow = true;
  torsoPivot.add(rifle);

  const rifleMag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.07), darkGearMat);
  rifleMag.position.set(0.26, 0.2, -0.52);
  rifleMag.rotation.x = -0.2;
  torsoPivot.add(rifleMag);

  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.set(0.26, 0.31, -0.86);
  torsoPivot.add(muzzlePoint);

  const muzzleFlash = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 8, 8),
    new THREE.MeshBasicMaterial({
      color: team === 'enemy' ? 0xff8a00 : 0x38bdf8,
      transparent: true,
      opacity: 0.92,
    })
  );
  muzzleFlash.position.copy(muzzlePoint.position);
  muzzleFlash.visible = false;
  torsoPivot.add(muzzleFlash);

  const headAnchor = new THREE.Object3D();
  headAnchor.position.set(0, 2.34, 0);
  root.add(headAnchor);

  return {
    root,
    hipsPivot,
    torsoPivot,
    leftThigh: leftLeg.thighGroup,
    leftKnee: leftLeg.kneePivot,
    rightThigh: rightLeg.thighGroup,
    rightKnee: rightLeg.kneePivot,
    headAnchor,
    shieldAura,
    muzzlePoint,
    muzzleFlash,
    armorMeshes,
  };
}

export function createPeakHouse(textures: TextureBundle, obstacles: ObstacleBox[]): THREE.Group {
  const group = new THREE.Group();
  const posX = -22;
  const posZ = -16;
  const baseY = groundHeightAt(posX, posZ);
  group.position.set(posX, baseY, posZ);

  const wallMat = new THREE.MeshStandardMaterial({ map: textures.stucco, roughness: 0.85 });
  const roofMat = new THREE.MeshStandardMaterial({ map: textures.roofTile, roughness: 0.68, metalness: 0.08 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b3e1f, roughness: 0.8 });
  const foundationMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.55,
    roughness: 0.2,
    metalness: 0.4,
  });

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.5, 8.2), foundationMat);
  plinth.position.y = 0.25;
  plinth.receiveShadow = true;
  group.add(plinth);

  const body = new THREE.Mesh(new THREE.BoxGeometry(8.8, 4.2, 7.2), wallMat);
  body.position.y = 2.6;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  [
    [-4.38, -3.58],
    [4.38, -3.58],
    [-4.38, 3.58],
    [4.38, 3.58],
  ].forEach(([cx, cz]) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 4.3, 0.28), woodMat);
    post.position.set(cx, 2.6, cz);
    post.castShadow = true;
    group.add(post);
  });

  const roofShape = new THREE.Shape();
  roofShape.moveTo(-5.0, 0);
  roofShape.lineTo(0, 2.7);
  roofShape.lineTo(5.0, 0);
  roofShape.closePath();

  const roofGeo = new THREE.ExtrudeGeometry(roofShape, {
    depth: 8.2,
    bevelEnabled: true,
    bevelThickness: 0.12,
    bevelSize: 0.12,
    bevelSegments: 2,
  });
  roofGeo.translate(0, 0, -4.1);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = 4.65;
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.2, 0.9), foundationMat);
  chimney.position.set(2.4, 6.2, -1.6);
  chimney.castShadow = true;
  group.add(chimney);

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.3, 1.3), woodMat);
  door.position.set(4.42, 1.65, 0);
  group.add(door);

  const win1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1, 1.2), windowMat);
  win1.position.set(4.42, 2.8, -2.0);
  const win2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1, 1.2), windowMat);
  win2.position.set(4.42, 2.8, 2.0);
  const winFront = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 0.16), windowMat);
  winFront.position.set(0, 2.8, 3.62);
  group.add(win1, win2, winFront);

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.8, 0.95),
    new THREE.MeshStandardMaterial({ map: textures.signPeak, roughness: 0.45 })
  );
  sign.position.set(4.5, 4.15, 0);
  sign.rotation.y = Math.PI / 2;
  group.add(sign);

  const signSouth = sign.clone();
  signSouth.position.set(0, 4.15, 3.7);
  signSouth.rotation.y = 0;
  group.add(signSouth);

  obstacles.push({
    minX: posX - 4.7,
    maxX: posX + 4.7,
    minZ: posZ - 4.0,
    maxZ: posZ + 4.0,
    height: 7.4,
    label: 'PEAK HOUSE',
  });

  return group;
}

export function createFactory(
  textures: TextureBundle,
  obstacles: ObstacleBox[]
): { group: THREE.Group; turbine: THREE.Group } {
  const group = new THREE.Group();
  const posX = 24;
  const posZ = -18;
  const baseY = groundHeightAt(posX, posZ);
  group.position.set(posX, baseY, posZ);

  const steelMat = new THREE.MeshStandardMaterial({
    map: textures.steelWall,
    roughness: 0.42,
    metalness: 0.58,
  });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.52, metalness: 0.38 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });
  const siloMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.28, metalness: 0.82 });

  const pad = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.4, 10.6), concreteMat);
  pad.position.y = 0.2;
  pad.receiveShadow = true;
  group.add(pad);

  const hall = new THREE.Mesh(new THREE.BoxGeometry(11.0, 5.2, 9.2), steelMat);
  hall.position.y = 2.9;
  hall.castShadow = true;
  hall.receiveShadow = true;
  group.add(hall);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(11.8, 0.45, 9.8), roofMat);
  roof.position.y = 5.7;
  roof.rotation.z = 0.08;
  roof.castShadow = true;
  group.add(roof);

  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.72, 4.2, 14), siloMat);
  stack.position.set(3.4, 7.2, -2.2);
  stack.castShadow = true;
  group.add(stack);

  const silo = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 4.6, 16), siloMat);
  silo.position.set(-3.8, 2.7, 3.2);
  silo.castShadow = true;
  group.add(silo);

  // Spinning rooftop industrial turbine fan
  const turbine = new THREE.Group();
  turbine.position.set(-1.6, 6.25, 1.2);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.3, 10), siloMat);
  turbine.add(hub);
  for (let b = 0; b < 4; b++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.24), siloMat);
    blade.rotation.y = (b / 4) * Math.PI * 2;
    turbine.add(blade);
  }
  group.add(turbine);

  const shutterMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.48, metalness: 0.65 });
  const shutter = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 3.4), shutterMat);
  shutter.position.set(-5.52, 2.0, 0);
  group.add(shutter);

  const signWest = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 1.1),
    new THREE.MeshStandardMaterial({ map: textures.signFactory, roughness: 0.4 })
  );
  signWest.position.set(-5.6, 4.6, 0);
  signWest.rotation.y = -Math.PI / 2;
  group.add(signWest);

  const signSouth = signWest.clone();
  signSouth.position.set(0, 4.6, 4.7);
  signSouth.rotation.y = 0;
  group.add(signSouth);

  obstacles.push({
    minX: posX - 5.8,
    maxX: posX + 5.8,
    minZ: posZ - 4.9,
    maxZ: posZ + 4.9,
    height: 6.2,
    label: 'FACTORY',
  });

  return { group, turbine };
}

export function createTree(type: 'oak' | 'palm', x: number, z: number, scale = 1): THREE.Group {
  const tree = new THREE.Group();
  const y = groundHeightAt(x, z);
  tree.position.set(x, y, z);
  tree.scale.setScalar(scale);

  const trunkMat = new THREE.MeshStandardMaterial({
    color: type === 'oak' ? 0x6b4226 : 0x7c5338,
    roughness: 0.88,
  });

  if (type === 'oak') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.38, 2.5, 10), trunkMat);
    trunk.position.y = 1.25;
    trunk.castShadow = true;
    tree.add(trunk);

    const leafMat1 = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.84 });
    const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x43a047, roughness: 0.8 });

    const c1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.45, 1), leafMat1);
    c1.position.set(0, 3.2, 0);
    c1.castShadow = true;
    const c2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05, 1), leafMat2);
    c2.position.set(0.85, 2.75, 0.45);
    c2.castShadow = true;
    const c3 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.0, 1), leafMat2);
    c3.position.set(-0.75, 2.85, -0.5);
    c3.castShadow = true;
    tree.add(c1, c2, c3);
  } else {
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24 - i * 0.03, 0.28 - i * 0.03, 1.05, 8),
        trunkMat
      );
      seg.position.set(i * 0.14, 0.5 + i * 0.95, 0);
      seg.rotation.z = -0.08 * i;
      seg.castShadow = true;
      tree.add(seg);
    }
    const frondMat = new THREE.MeshStandardMaterial({
      color: 0x2e8b3c,
      roughness: 0.78,
      side: THREE.DoubleSide,
    });
    for (let a = 0; a < 6; a++) {
      const angle = (a / 6) * Math.PI * 2;
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.3, 4), frondMat);
      frond.position.set(0.45 + Math.cos(angle) * 0.95, 4.15, Math.sin(angle) * 0.95);
      frond.rotation.z = -Math.PI / 2.6;
      frond.rotation.y = -angle;
      frond.castShadow = true;
      tree.add(frond);
    }
  }

  return tree;
}

export function createCrate(
  textures: TextureBundle,
  x: number,
  z: number,
  size: number,
  obstacles: ObstacleBox[],
  mapId: MapId = 'peak'
): THREE.Group {
  const group = new THREE.Group();
  const y = groundHeightAt(x, z, mapId);
  group.position.set(x, y, z);

  const crateMat = new THREE.MeshStandardMaterial({
    map: textures.crateWood,
    roughness: 0.78,
    metalness: 0.06,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), crateMat);
  mesh.position.y = size / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  const half = size * 0.52;
  obstacles.push({
    minX: x - half,
    maxX: x + half,
    minZ: z - half,
    maxZ: z + half,
    height: size,
  });

  return group;
}

export function createMedkit(x: number, z: number, mapId: MapId = 'peak'): THREE.Group {
  const group = new THREE.Group();
  const y = groundHeightAt(x, z, mapId);
  group.position.set(x, y + 0.45, z);

  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.48, 0.52),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 })
  );
  box.castShadow = true;
  group.add(box);

  const crossMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x10b981,
    emissiveIntensity: 0.65,
    roughness: 0.25,
  });
  const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.55), crossMat);
  const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.55), crossMat);
  group.add(bar1, bar2);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 0.58, 20),
    new THREE.MeshBasicMaterial({
      color: 0x34d399,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.72,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.4;
  group.add(ring);

  return group;
}

export function createEnvironment(textures: TextureBundle): {
  envGroup: THREE.Group;
  safeZoneRing: THREE.Mesh;
  cloudsGroup: THREE.Group;
} {
  const envGroup = new THREE.Group();

  const terrainGeo = new THREE.PlaneGeometry(240, 240, 96, 96);
  terrainGeo.rotateX(-Math.PI / 2);
  const posAttr = terrainGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    posAttr.setY(i, groundHeightAt(vx, vz));
  }
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    map: textures.grass,
    roughness: 0.92,
    metalness: 0.0,
  });
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.receiveShadow = true;
  envGroup.add(terrain);

  const roadGeo = new THREE.PlaneGeometry(7.2, 160, 8, 48);
  roadGeo.rotateX(-Math.PI / 2);
  const rPos = roadGeo.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    const vx = rPos.getX(i);
    const vz = rPos.getZ(i);
    rPos.setY(i, groundHeightAt(vx, vz) + 0.04);
  }
  roadGeo.computeVertexNormals();
  const roadMat = new THREE.MeshStandardMaterial({
    map: textures.road,
    roughness: 0.94,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.receiveShadow = true;
  envGroup.add(road);

  const mountainGroup = new THREE.Group();
  const mtnColors = [0x4d6b26, 0x556b2f, 0x3f5e20];
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    const dist = 88 + (i % 3) * 10;
    const height = 22 + ((i * 7) % 18);
    const radius = 14 + ((i * 5) % 8);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(radius, height, 7),
      new THREE.MeshStandardMaterial({
        color: mtnColors[i % mtnColors.length],
        roughness: 0.95,
        flatShading: true,
      })
    );
    cone.position.set(Math.cos(angle) * dist, height * 0.42, Math.sin(angle) * dist);
    cone.rotation.y = i * 0.7;
    mountainGroup.add(cone);
  }
  envGroup.add(mountainGroup);

  const cloudsGroup = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.95,
    emissive: 0xe0f2fe,
    emissiveIntensity: 0.25,
  });
  const cloudCoords: Array<[number, number, number, number]> = [
    [-42, 46, -65, 1.5],
    [18, 52, -78, 1.9],
    [56, 44, -50, 1.3],
    [-64, 42, 12, 1.6],
    [62, 48, 28, 1.4],
  ];
  for (const [cx, cy, cz, sc] of cloudCoords) {
    const cloud = new THREE.Group();
    cloud.position.set(cx, cy, cz);
    cloud.scale.setScalar(sc);
    const p1 = new THREE.Mesh(new THREE.SphereGeometry(4.2, 10, 8), cloudMat);
    const p2 = new THREE.Mesh(new THREE.SphereGeometry(3.3, 10, 8), cloudMat);
    p2.position.set(3.8, -0.5, 0.4);
    const p3 = new THREE.Mesh(new THREE.SphereGeometry(3.1, 10, 8), cloudMat);
    p3.position.set(-3.6, -0.6, -0.3);
    cloud.add(p1, p2, p3);
    cloudsGroup.add(cloud);
  }
  envGroup.add(cloudsGroup);

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(7.2, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff3b0 })
  );
  sun.position.set(55, 62, -95);
  envGroup.add(sun);

  const safeZoneGeo = new THREE.RingGeometry(63.3, 64.3, 72);
  safeZoneGeo.rotateX(-Math.PI / 2);
  const safeZoneRing = new THREE.Mesh(
    safeZoneGeo,
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    })
  );
  safeZoneRing.position.y = 0.25;
  envGroup.add(safeZoneRing);

  return { envGroup, safeZoneRing, cloudsGroup };
}

export function createSpawnPad(
  x: number,
  z: number,
  mapId: MapId,
  team: 'ally' | 'enemy' | 'neutral'
): THREE.Group {
  const group = new THREE.Group();
  const y = groundHeightAt(x, z, mapId);
  group.position.set(x, y + 0.04, z);

  const colorHex = team === 'ally' ? 0x38bdf8 : team === 'enemy' ? 0xf43f5e : 0xfbbf24;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.05, 1.35, 28),
    new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);

  const innerDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 24),
    new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
    })
  );
  innerDisc.rotation.x = -Math.PI / 2;
  group.add(innerDisc);

  return group;
}

export function createLondonEnvironment(
  textures: TextureBundle,
  obstacles: ObstacleBox[]
): {
  envGroup: THREE.Group;
  safeZoneRing: THREE.Mesh;
  cloudsGroup: THREE.Group;
} {
  const envGroup = new THREE.Group();

  // North & South Westminster Limestone Plaza Embankments (keeping Thames Channel open between z=-4.8..4.8)
  const plazaMat = new THREE.MeshStandardMaterial({
    map: textures.londonStone,
    roughness: 0.86,
    metalness: 0.04,
  });

  const northGround = new THREE.Mesh(new THREE.PlaneGeometry(220, 110), plazaMat);
  northGround.rotation.x = -Math.PI / 2;
  northGround.position.set(0, 0.01, -59.8);
  northGround.receiveShadow = true;
  envGroup.add(northGround);

  const southGround = new THREE.Mesh(new THREE.PlaneGeometry(220, 110), plazaMat);
  southGround.rotation.x = -Math.PI / 2;
  southGround.position.set(0, 0.01, 59.8);
  southGround.receiveShadow = true;
  envGroup.add(southGround);

  // River Thames shimmering water channel (z = -4.8 .. +4.8)
  const thamesMat = new THREE.MeshPhysicalMaterial({
    map: textures.thamesWater,
    color: 0x0e7490,
    roughness: 0.16,
    metalness: 0.25,
    clearcoat: 0.9,
  });
  const thames = new THREE.Mesh(new THREE.PlaneGeometry(220, 10.2), thamesMat);
  thames.rotation.x = -Math.PI / 2;
  thames.position.set(0, -0.58, 0);
  thames.receiveShadow = true;
  envGroup.add(thames);

  // Stone Embankment Walls along River Thames with openings at the 3 Bridges (x=-22, x=0, x=22)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.78 });
  const parapetSegments: Array<[number, number]> = [
    [-70, -25.8],
    [-18.2, -5.8],
    [5.8, 18.2],
    [25.8, 70],
  ];
  for (const [x1, x2] of parapetSegments) {
    const w = x2 - x1;
    const cx = (x1 + x2) * 0.5;
    for (const sideZ of [-5.0, 5.0]) {
      const parapet = new THREE.Mesh(new THREE.BoxGeometry(w, 1.35, 0.65), wallMat);
      parapet.position.set(cx, 0.45, sideZ);
      parapet.castShadow = true;
      parapet.receiveShadow = true;
      envGroup.add(parapet);

      obstacles.push({
        minX: x1,
        maxX: x2,
        minZ: sideZ - 0.35,
        maxZ: sideZ + 0.35,
        height: 1.4,
      });
    }
  }

  // Central London Tarmac Avenue & 2 Flanking Bridge Crossings
  const tarmacMat = new THREE.MeshStandardMaterial({
    map: textures.londonCobble,
    roughness: 0.85,
  });
  const mainAvenue = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 160), tarmacMat);
  mainAvenue.rotation.x = -Math.PI / 2;
  mainAvenue.position.set(0, 0.04, 0);
  mainAvenue.receiveShadow = true;
  envGroup.add(mainAvenue);

  const crossRoadNorth = new THREE.Mesh(new THREE.PlaneGeometry(150, 7.6), tarmacMat);
  crossRoadNorth.rotation.x = -Math.PI / 2;
  crossRoadNorth.rotation.z = Math.PI / 2;
  crossRoadNorth.position.set(0, 0.035, -13);
  crossRoadNorth.receiveShadow = true;
  envGroup.add(crossRoadNorth);

  // 3 Arched Bridge Decks across Thames
  const bridgeSpecs: Array<{ cx: number; width: number }> = [
    { cx: 0, width: 11.2 },
    { cx: -22, width: 7.2 },
    { cx: 22, width: 7.2 },
  ];
  for (const b of bridgeSpecs) {
    const deckGeo = new THREE.BoxGeometry(b.width, 0.55, 10.6, 4, 1, 14);
    const pos = deckGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vz = pos.getZ(i);
      const arch = Math.cos((vz / 5.3) * (Math.PI * 0.5)) * 0.45;
      pos.setY(i, pos.getY(i) + arch);
    }
    deckGeo.computeVertexNormals();
    const deck = new THREE.Mesh(deckGeo, tarmacMat);
    deck.position.set(b.cx, -0.1, 0);
    deck.receiveShadow = true;
    deck.castShadow = true;
    envGroup.add(deck);
  }

  // London City Skyline Silhouettes + London Eye Ferris Wheel in North-East distance
  const skyBldgMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.72 });
  for (let i = 0; i < 20; i++) {
    const ang = (i / 20) * Math.PI * 2;
    const dist = 84 + (i % 3) * 8;
    const bw = 9 + (i % 4) * 3;
    const bh = 16 + ((i * 7) % 24);
    const bd = 9 + (i % 3) * 3;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), skyBldgMat);
    tower.position.set(Math.cos(ang) * dist, bh * 0.5, Math.sin(ang) * dist);
    envGroup.add(tower);
  }

  // Iconic London Eye Giant Wheel on the far East Embankment skyline
  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(64, 22, 6);
  const wheelRim = new THREE.Mesh(
    new THREE.TorusGeometry(19, 0.45, 10, 40),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0x38bdf8, emissiveIntensity: 0.35 })
  );
  wheelGroup.add(wheelRim);
  for (let s = 0; s < 12; s++) {
    const spoke = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 38, 6),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1 })
    );
    spoke.rotation.z = (s / 12) * Math.PI;
    wheelGroup.add(spoke);
  }
  envGroup.add(wheelGroup);

  // London Drifting Clouds
  const cloudsGroup = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.95,
    emissive: 0xcbd5e1,
    emissiveIntensity: 0.2,
  });
  const cloudCoords: Array<[number, number, number, number]> = [
    [-38, 44, -62, 1.7],
    [16, 48, -74, 2.0],
    [54, 42, -46, 1.5],
    [-60, 40, 14, 1.7],
    [60, 45, 24, 1.5],
  ];
  for (const [cx, cy, cz, sc] of cloudCoords) {
    const cloud = new THREE.Group();
    cloud.position.set(cx, cy, cz);
    cloud.scale.setScalar(sc);
    const p1 = new THREE.Mesh(new THREE.SphereGeometry(4.4, 10, 8), cloudMat);
    const p2 = new THREE.Mesh(new THREE.SphereGeometry(3.4, 10, 8), cloudMat);
    p2.position.set(3.8, -0.5, 0.4);
    const p3 = new THREE.Mesh(new THREE.SphereGeometry(3.2, 10, 8), cloudMat);
    p3.position.set(-3.6, -0.6, -0.3);
    cloud.add(p1, p2, p3);
    cloudsGroup.add(cloud);
  }
  envGroup.add(cloudsGroup);

  const safeZoneGeo = new THREE.RingGeometry(63.3, 64.3, 72);
  safeZoneGeo.rotateX(-Math.PI / 2);
  const safeZoneRing = new THREE.Mesh(
    safeZoneGeo,
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    })
  );
  safeZoneRing.position.y = 0.28;
  envGroup.add(safeZoneRing);

  return { envGroup, safeZoneRing, cloudsGroup };
}

export function createBigBen(textures: TextureBundle, obstacles: ObstacleBox[]): THREE.Group {
  const group = new THREE.Group();
  const posX = -26;
  const posZ = -20;
  group.position.set(posX, 0, posZ);

  const limestoneMat = new THREE.MeshStandardMaterial({ color: 0xd6c7a9, roughness: 0.78 });
  const darkRoofMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.4 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.25, metalness: 0.85 });
  const clockMat = new THREE.MeshStandardMaterial({
    map: textures.bigBenClock,
    emissive: 0xfef3c7,
    emissiveMap: textures.bigBenClock,
    emissiveIntensity: 0.45,
    roughness: 0.35,
  });

  // Westminster Base Hall
  const base = new THREE.Mesh(new THREE.BoxGeometry(8.6, 5.2, 8.6), limestoneMat);
  base.position.y = 2.6;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Elizabeth Tower Shaft
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(5.2, 16.5, 5.2), limestoneMat);
  shaft.position.y = 12.2;
  shaft.castShadow = true;
  group.add(shaft);

  // Clock Section + 4 Glowing Clock Faces
  const belfry = new THREE.Mesh(new THREE.BoxGeometry(5.8, 5.4, 5.8), limestoneMat);
  belfry.position.y = 22.8;
  belfry.castShadow = true;
  group.add(belfry);

  const dialConfigs: Array<[number, number, number, number]> = [
    [0, 22.8, 2.94, 0],
    [0, 22.8, -2.94, Math.PI],
    [2.94, 22.8, 0, Math.PI / 2],
    [-2.94, 22.8, 0, -Math.PI / 2],
  ];
  for (const [dx, dy, dz, ry] of dialConfigs) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.8), clockMat);
    face.position.set(dx, dy, dz);
    face.rotation.y = ry;
    group.add(face);
  }

  // Gothic Spire & Gold Finial
  const spire = new THREE.Mesh(new THREE.ConeGeometry(4.1, 7.8, 4), darkRoofMat);
  spire.position.y = 29.3;
  spire.rotation.y = Math.PI / 4;
  spire.castShadow = true;
  group.add(spire);

  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.2, 8), goldMat);
  finial.position.y = 34.0;
  group.add(finial);

  obstacles.push({
    minX: posX - 4.5,
    maxX: posX + 4.5,
    minZ: posZ - 4.5,
    maxZ: posZ + 4.5,
    height: 34.0,
    label: 'BIG BEN',
  });

  return group;
}

export function createTowerBridge(obstacles: ObstacleBox[]): THREE.Group {
  const group = new THREE.Group();
  const limestoneMat = new THREE.MeshStandardMaterial({ color: 0xcbbba0, roughness: 0.76 });
  const tealSteelMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.36,
    metalness: 0.62,
  });
  const slateRoofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.55 });

  // Twin Gothic Towers flanking Center Bridge (at x = -6.8 & x = +6.8)
  for (const tx of [-6.8, 6.8]) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(3.0, 12.6, 3.8), limestoneMat);
    tower.position.set(tx, 6.0, 0);
    tower.castShadow = true;
    tower.receiveShadow = true;
    group.add(tower);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.5, 4.2, 4), slateRoofMat);
    roof.position.set(tx, 14.4, 0);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);

    obstacles.push({
      minX: tx - 1.65,
      maxX: tx + 1.65,
      minZ: -2.05,
      maxZ: 2.05,
      height: 15.0,
      label: 'TOWER BRIDGE',
    });
  }

  // Twin High-Level Pedestrian Skywalks
  for (const wz of [-1.0, 1.0]) {
    const skywalk = new THREE.Mesh(new THREE.BoxGeometry(11.6, 1.1, 0.8), tealSteelMat);
    skywalk.position.set(0, 10.8, wz);
    skywalk.castShadow = true;
    group.add(skywalk);
  }

  return group;
}

export function createRedBus(
  textures: TextureBundle,
  x: number,
  z: number,
  rotY: number,
  obstacles: ObstacleBox[]
): THREE.Group {
  const group = new THREE.Group();
  const y = groundHeightAt(x, z, 'london');
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const sideMat = new THREE.MeshStandardMaterial({ map: textures.redBusSide, roughness: 0.35 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0xc81e1e, roughness: 0.38, metalness: 0.15 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.6, 6.4), [
    sideMat,
    sideMat,
    redMat,
    redMat,
    redMat,
    redMat,
  ]);
  body.position.y = 2.05;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  for (const wx of [-1.15, 1.15]) {
    for (const wz of [-2.0, 2.0]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 12), wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.45, wz);
      group.add(wheel);
    }
  }

  const rotatedLong = Math.abs(Math.sin(rotY)) > 0.7;
  const hx = rotatedLong ? 3.3 : 1.3;
  const hz = rotatedLong ? 1.3 : 3.3;
  obstacles.push({
    minX: x - hx,
    maxX: x + hx,
    minZ: z - hz,
    maxZ: z + hz,
    height: 3.9,
    label: 'LONDON BUS',
  });

  return group;
}

export function createPhoneBooth(x: number, z: number, obstacles: ObstacleBox[]): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, groundHeightAt(x, z, 'london'), z);

  const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.55,
    roughness: 0.1,
  });

  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.5, 1.1), redMat);
  frame.position.y = 1.25;
  frame.castShadow = true;
  group.add(frame);

  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.14, 1.5, 0.8), glassMat);
  glass.position.y = 1.35;
  group.add(glass);

  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.56, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), redMat);
  dome.position.y = 2.48;
  group.add(dome);

  obstacles.push({
    minX: x - 0.65,
    maxX: x + 0.65,
    minZ: z - 0.65,
    maxZ: z + 0.65,
    height: 2.8,
  });

  return group;
}

export function createUndergroundEntrance(
  textures: TextureBundle,
  x: number,
  z: number,
  obstacles: ObstacleBox[]
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, groundHeightAt(x, z, 'london'), z);

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 });
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(6.4, 3.2, 4.6), stoneMat);
  canopy.position.y = 1.6;
  canopy.castShadow = true;
  canopy.receiveShadow = true;
  group.add(canopy);

  const roundelMat = new THREE.MeshStandardMaterial({
    map: textures.signUnderground,
    emissive: 0xffffff,
    emissiveMap: textures.signUnderground,
    emissiveIntensity: 0.35,
  });
  const signFront = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.0), roundelMat);
  signFront.position.set(0, 2.1, 2.34);
  const signBack = signFront.clone();
  signBack.position.z = -2.34;
  signBack.rotation.y = Math.PI;
  group.add(signFront, signBack);

  obstacles.push({
    minX: x - 3.3,
    maxX: x + 3.3,
    minZ: z - 2.4,
    maxZ: z + 2.4,
    height: 3.3,
    label: 'UNDERGROUND',
  });

  return group;
}

export function createLondonTownhouse(
  textures: TextureBundle,
  x: number,
  z: number,
  w: number,
  h: number,
  d: number,
  obstacles: ObstacleBox[]
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, groundHeightAt(x, z, 'london'), z);

  const brickMat = new THREE.MeshStandardMaterial({ map: textures.londonBrick, roughness: 0.84 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.72 });
  const winMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.45,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), brickMat);
  body.position.y = h * 0.5;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.5, d + 0.4), roofMat);
  cap.position.y = h + 0.25;
  group.add(cap);

  const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, 1.4, d + 0.12), winMat);
  win.position.y = h * 0.58;
  group.add(win);

  obstacles.push({
    minX: x - w * 0.52,
    maxX: x + w * 0.52,
    minZ: z - d * 0.52,
    maxZ: z + d * 0.52,
    height: h + 0.5,
  });

  return group;
}

