import * as THREE from "three";
import { GLTFLoader } from "../vendor/three/loaders/GLTFLoader.js";
import { fitGuideModel } from "./guide-model.mjs?v=formal-walk-2";
import { createWalkingPresenter } from "./guide-animation.mjs?v=formal-walk-2";
import { createNavigator, destination, GUIDE_RADIUS } from './guide-navigation.mjs?v=shadowed-ensemble-1';

const portfolio = JSON.parse(document.querySelector('#portfolio-data').textContent);
const canvas = document.querySelector('#worldCanvas');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0b1020, 0.015);
const camera = new THREE.PerspectiveCamera(90, innerWidth / innerHeight, 0.1, 250);
camera.position.set(0, 1.95, 3.1);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
scene.add(camera);

scene.add(new THREE.HemisphereLight(0xd6e5ff, 0x302015, 1.8));
const keyLight = new THREE.DirectionalLight(0xffead8, 2.8);
keyLight.position.set(8, 12, 9);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.left = -9;
keyLight.shadow.camera.right = 9;
keyLight.shadow.camera.top = 8;
keyLight.shadow.camera.bottom = -8;
keyLight.shadow.normalBias = .035;
scene.add(keyLight);
scene.add(keyLight.target);
const fillLight = new THREE.DirectionalLight(0xb4d8ff, 1.1);
fillLight.position.set(-4, 5, 3);
scene.add(fillLight);

const mat = (color, roughness = .74, metalness = .04) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const palette = [0xc8ff3d, 0xff7a68, 0x6fffd8, 0x9d88ff, 0xffcc5c, 0x66b7ff, 0xc8ff3d];
const viewerRig = new THREE.Group();
camera.add(viewerRig);
const viewerSleeve = mat(0x172342, .58);
const viewerSkin = mat(0xb87554, .78);
for (const side of [-1, 1]) {
  const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(.11, .52, 6, 10), viewerSleeve);
  forearm.position.set(side * .82, -.73, -1.45);
  forearm.rotation.z = side * -.48;
  forearm.rotation.x = -.35;
  viewerRig.add(forearm);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(.15, 14, 12), viewerSkin);
  hand.scale.set(.78, 1.18, .72);
  hand.position.set(side * 1.01, -.9, -1.67);
  viewerRig.add(hand);
}
const roomGap = 13.5;
const rooms = [];
const doors = [];
const guideDoors = [];
const animatedObjects = [];
const guideObstacles = [];
let workstationScreen;

// Shared material textures keep the architecture detailed without adding asset requests.
const floorCanvas = document.createElement('canvas');
floorCanvas.width = floorCanvas.height = 512;
const floorContext = floorCanvas.getContext('2d');
floorContext.fillStyle = '#241a17';
floorContext.fillRect(0, 0, 512, 512);
for (let plank = 0; plank < 8; plank++) {
  floorContext.fillStyle = ['#594237', '#62483b', '#503b32', '#6a4d3c'][plank % 4];
  floorContext.fillRect(plank * 64 + 1, 0, 62, 512);
  for (let grain = 0; grain < 16; grain++) {
    floorContext.strokeStyle = grain % 2 ? 'rgba(16,8,4,.1)' : 'rgba(232,188,133,.07)';
    floorContext.beginPath();
    const x = plank * 64 + 3 + grain * 3.7;
    floorContext.moveTo(x, 0);
    floorContext.bezierCurveTo(x + 5, 170, x - 5, 350, x, 512);
    floorContext.stroke();
  }
  floorContext.fillStyle = '#2d211b';
  floorContext.fillRect(plank * 64, plank % 2 ? 180 : 390, 64, 2);
}
const floorTexture = new THREE.CanvasTexture(floorCanvas);
floorTexture.colorSpace = THREE.SRGBColorSpace;
floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
floorTexture.repeat.set(2, 2);
floorTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
const oakFloor = new THREE.MeshStandardMaterial({ map: floorTexture, roughness: .64, metalness: .06 });
const brassTrim = mat(0xc7a571, .38, .62);

function box(width, height, depth, material, x, y, z, parent, shadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  parent.add(mesh);
  if (parent.userData.furnitureZone && y + height / 2 > .45) {
    guideObstacles.push({ minX: parent.position.x + x - width / 2, maxX: parent.position.x + x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 });
  }
  return mesh;
}

function makeTextPanel(text, color = '#c8ff3d') {
  const textCanvas = document.createElement('canvas');
  textCanvas.width = 768;
  textCanvas.height = 150;
  const context = textCanvas.getContext('2d');
  context.clearRect(0, 0, textCanvas.width, textCanvas.height);
  context.font = '600 48px monospace';
  context.letterSpacing = '5px';
  context.fillStyle = color;
  context.textAlign = 'center';
  context.fillText(text.toUpperCase(), textCanvas.width / 2, 92);
  const texture = new THREE.CanvasTexture(textCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(4.8, .94), new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false }));
  return panel;
}

function drawWrappedText(context, text, x, y, maxWidth, lineHeight, maxLines = 4) {
  const words = String(text).split(/\s+/);
  let line = '';
  let lines = 0;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (context.measureText(testLine).width > maxWidth && line) {
      context.fillText(line, x, y);
      y += lineHeight;
      lines += 1;
      line = word;
      if (lines >= maxLines) return y;
    } else line = testLine;
  }
  if (line && lines < maxLines) context.fillText(line, x, y);
  return y + lineHeight;
}

function makeInfoPanel(kicker, title, lines, accentColor = '#c8ff3d', width = 4.7, height = 2.9) {
  const panelCanvas = document.createElement('canvas');
  panelCanvas.width = 1100;
  panelCanvas.height = 680;
  const context = panelCanvas.getContext('2d');
  context.clearRect(0, 0, panelCanvas.width, panelCanvas.height);
  context.shadowColor = 'rgba(0,0,0,.9)';
  context.shadowBlur = 18;
  context.fillStyle = accentColor;
  context.fillRect(54, 52, 8, 560);
  context.font = '600 25px monospace';
  context.letterSpacing = '4px';
  context.fillText(kicker.toUpperCase(), 96, 95);
  context.fillStyle = '#f5f1e8';
  context.font = '700 58px sans-serif';
  let y = drawWrappedText(context, title.toUpperCase(), 96, 172, 900, 66, 2) + 22;
  context.font = '400 27px sans-serif';
  for (const line of lines.filter(Boolean)) {
    context.fillStyle = '#c3ccdc';
    y = drawWrappedText(context, `• ${line}`, 100, y, 900, 39, 2) + 11;
    if (y > 625) break;
  }
  const texture = new THREE.CanvasTexture(panelCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
}

const skillTextureLoader = new THREE.TextureLoader();
skillTextureLoader.setCrossOrigin('anonymous');

function makeSkillLogo(skill, index) {
  const group = new THREE.Group();
  const accentColor = palette[(index + 2) % palette.length];
  box(1.02, 1.02, .08, mat(accentColor, .3, .5), 0, 0, -.08, group);
  box(.92, .92, .16, mat(0x10182a, .4, .3), 0, 0, 0, group);
  // A raised light inset keeps dark brand marks readable and prevents z-fighting with the black screen.
  box(.78, .78, .025, mat(0xf6f7fb, .42, .04), 0, 0, .092, group, false);

  const fallbackCanvas = document.createElement('canvas');
  fallbackCanvas.width = 512;
  fallbackCanvas.height = 512;
  const fallbackContext = fallbackCanvas.getContext('2d');
  fallbackContext.fillStyle = `#${accentColor.toString(16).padStart(6, '0')}`;
  fallbackContext.beginPath();
  fallbackContext.arc(256, 256, 190, 0, Math.PI * 2);
  fallbackContext.fill();
  fallbackContext.fillStyle = '#0a1020';
  fallbackContext.font = '700 150px sans-serif';
  fallbackContext.textAlign = 'center';
  fallbackContext.textBaseline = 'middle';
  const initials = skill.name.split(/\s+/).map((word) => word[0]).join('').slice(0, 3);
  fallbackContext.fillText(initials, 256, 270);
  const fallbackTexture = new THREE.CanvasTexture(fallbackCanvas);
  fallbackTexture.colorSpace = THREE.SRGBColorSpace;

  const logoMaterial = new THREE.MeshBasicMaterial({ map: fallbackTexture, transparent: true, alphaTest: .02, side: THREE.DoubleSide, toneMapped: false });
  const logoFace = new THREE.Mesh(new THREE.PlaneGeometry(.7, .7), logoMaterial);
  logoFace.position.z = .108;
  group.add(logoFace);

  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 600;
  labelCanvas.height = 128;
  const labelContext = labelCanvas.getContext('2d');
  labelContext.fillStyle = 'rgba(5, 9, 20, .88)';
  labelContext.fillRect(0, 0, 600, 128);
  labelContext.strokeStyle = `#${accentColor.toString(16).padStart(6, '0')}`;
  labelContext.lineWidth = 5;
  labelContext.strokeRect(3, 3, 594, 122);
  labelContext.fillStyle = '#f5f1e8';
  labelContext.font = '600 39px monospace';
  labelContext.textAlign = 'center';
  labelContext.textBaseline = 'middle';
  labelContext.fillText(skill.name.toUpperCase(), 300, 65, 550);
  const labelTexture = new THREE.CanvasTexture(labelCanvas);
  labelTexture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(1.08, .23), new THREE.MeshBasicMaterial({ map: labelTexture, transparent: true, side: THREE.DoubleSide, toneMapped: false }));
  label.position.set(0, -.64, .1);
  group.add(label);

  if (skill.logo) {
    skillTextureLoader.load(skill.logo, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
      logoMaterial.map = texture;
      logoMaterial.needsUpdate = true;
      fallbackTexture.dispose();
    });
  }
  return group;
}

function addDoorway(group, index, accent, wallMat) {
  // The visitor and the presenter use visibly separate passages.
  box(.28, 6.4, 1.42, wallMat, 5.06, 3, -3.19, group, false);
  box(.28, 6.4, 1.98, wallMat, 5.06, 3, .1, group, false);
  box(.28, 6.4, .62, wallMat, 5.06, 3, 3.59, group, false);

  box(.42, 3.9, .16, accent, 4.82, 1.95, -2.47, group);
  box(.42, 3.9, .16, accent, 4.82, 1.95, -.92, group);
  box(.42, .22, 1.72, accent, 4.82, 3.86, -1.7, group);
  const guideHinge = new THREE.Group();
  guideHinge.position.set(4.86, 0, -2.39);
  group.add(guideHinge);
  box(.18, 3.56, 1.38, mat(0x27375a, .68, .18), 0, 1.78, .69, guideHinge);
  const guideHandle = new THREE.Mesh(new THREE.SphereGeometry(.07, 12, 8), mat(0xe9c982, .26, .78));
  guideHandle.position.set(-.13, 1.72, 1.16);
  guideHinge.add(guideHandle);
  guideHinge.userData.openAmount = 0;
  guideHinge.userData.openDirection = 1;
  guideDoors[index] = guideHinge;

  const guideSign = makeTextPanel('GUIDE', `#${palette[index].toString(16).padStart(6, '0')}`);
  guideSign.scale.set(.31, .31, .31);
  guideSign.rotation.y = Math.PI / 2;
  guideSign.position.set(4.78, 4.22, -1.7);
  group.add(guideSign);

  box(.34, 2.65, 2.15, wallMat, 5.03, 4.74, 2.2, group, false);
  box(.42, 3.45, .18, accent, 4.82, 1.72, 1.12, group);
  box(.42, 3.45, .18, accent, 4.82, 1.72, 3.28, group);
  box(.42, .22, 2.34, accent, 4.82, 3.42, 2.2, group);

  const hinge = new THREE.Group();
  hinge.position.set(4.86, 0, 1.22);
  group.add(hinge);
  const panel = box(.18, 3.18, 1.96, mat(0x344469, .72, .12), 0, 1.61, .98, hinge);
  box(.2, .18, 1.72, accent, -.12, 3.02, .98, hinge, false);
  const handle = new THREE.Mesh(new THREE.SphereGeometry(.085, 14, 10), mat(0xe9c982, .26, .78));
  handle.position.set(-.14, 1.66, 1.7);
  hinge.add(handle);
  panel.userData.kind = 'room-door';
  hinge.userData.openAmount = 0;
  hinge.userData.openDirection = 1;
  doors[index] = hinge;

  const visitorSign = makeTextPanel('VISITOR', `#${palette[index].toString(16).padStart(6, '0')}`);
  visitorSign.scale.set(.38, .38, .38);
  visitorSign.rotation.y = Math.PI / 2;
  visitorSign.position.set(4.77, 3.8, 2.2);
  group.add(visitorSign);

  box(3.76, .3, 2.38, mat(0x11192c, .9), 6.95, -.02, 2.2, group);
  box(3.76, .3, 1.58, mat(0x11192c, .9), 6.95, -.02, -1.7, group);
  box(3.76, 1.05, .18, wallMat, 6.95, .58, 1.04, group, false);
  box(3.76, 1.05, .18, wallMat, 6.95, .58, 3.36, group, false);
  box(3.76, 1.05, .18, wallMat, 6.95, .58, -2.5, group, false);
  box(3.76, 1.05, .18, wallMat, 6.95, .58, -.9, group, false);
  for (let stripe = 0; stripe < 4; stripe++) box(.12, .035, 1.95, accent, 5.45 + stripe * .95, .18, 2.2, group, false);
}

function addRoomShell(index, label) {
  const group = new THREE.Group();
  group.position.x = index * roomGap;
  scene.add(group);
  const accent = mat(palette[index], .48, .18);
  const floorMat = oakFloor;
  const wallMat = mat(index % 2 ? 0x1d2937 : 0x263440, .88);
  box(10.4, .34, 7.8, floorMat, 0, 0, 0, group);
  box(10.4, 6.4, .3, wallMat, 0, 3, -3.75, group, false);
  if (index < 6) addDoorway(group, index, accent, wallMat);
  else box(.28, 6.4, 7.8, wallMat, 5.06, 3, 0, group, false);
  box(10.4, .12, .18, brassTrim, 0, 6.13, -3.55, group, false);
  box(10.1, .2, .08, brassTrim, 0, .3, -3.54, group, false);
  const lightStrip = new THREE.MeshBasicMaterial({ color: palette[index], toneMapped: false });
  box(9.8, .025, .035, lightStrip, 0, .43, -3.49, group, false);
  for (const side of [-1, 1]) {
    for (let slat = 0; slat < 5; slat++) {
      box(.035, 5.45, .06, brassTrim, side * (4.38 + slat * .14), 3.05, -3.53, group, false);
    }
    box(.16, 1.1, .16, brassTrim, side * 3.95, 3.65, -3.39, group, false);
    box(.045, .9, .03, new THREE.MeshBasicMaterial({ color: 0xffd8a0, toneMapped: false }), side * 3.95, 3.65, -3.29, group, false);
  }
  const rug = new THREE.Mesh(new THREE.CircleGeometry(2.4, 64), mat(index % 2 ? 0x253d42 : 0x28334d, 1));
  rug.rotation.x = -Math.PI / 2;
  rug.scale.set(1.38, .68, 1);
  rug.position.set(0, .19, .25);
  rug.receiveShadow = true;
  group.add(rug);
  const labelPanel = makeTextPanel(`0${index}  /  ${label}`, `#${palette[index].toString(16).padStart(6, '0')}`);
  labelPanel.position.set(0, 5.15, -3.53);
  group.add(labelPanel);
  const light = new THREE.PointLight(palette[index], 9, 12, 2);
  light.position.set(-3.8, 3.4, 2.4);
  group.add(light);
  rooms.push(group);
  group.userData.furnitureZone = true;
  return { group, accent, wallMat, floorMat };
}

function createFoyer(index) {
  const { group, accent } = addRoomShell(index, 'WELCOME');
  const welcomeInfo = makeInfoPanel('Welcome / Abhishek Kumar', 'Data Scientist', [portfolio.title, 'Machine Learning · Analytics · AI', 'Based in Bettiah, India']);
  welcomeInfo.position.set(-1.2, 3.15, -3.54);
  group.add(welcomeInfo);
  box(2.4, .22, .7, mat(0x7d8aac), 2.3, 1.05, -2.7, group);
  box(.18, .95, .18, mat(0x171d2d), 1.38, .58, -2.7, group);
  box(.18, .95, .18, mat(0x171d2d), 3.2, .58, -2.7, group);
}

function createExperience(index) {
  const { group, accent } = addRoomShell(index, 'EXPERIENCE');
  const experience = portfolio.experience[0];
  box(4.3, .18, 1.5, mat(0x81533f), -.3, 1.3, -2.65, group);
  for (const x of [-2.1, 1.5]) box(.18, 1.2, .18, mat(0x181d2a), x, .67, -2.65, group);
  const bars = [1.1, 1.85, 1.35, 2.65, 2.15];
  bars.forEach((height, i) => box(.38, height, .32, i === 3 ? accent : mat(0x66769e), -4 + i * .62, 1.3 + height / 2, -3.32, group));
  const laptop = box(1.65, .95, .08, mat(0x0c111c, .4, .7), -.2, 1.9, -2.45, group);
  laptop.rotation.x = -.12;
  for (let i = 0; i < 7; i++) {
    const node = new THREE.Mesh(new THREE.SphereGeometry(.08 + i * .005, 12, 10), accent);
    node.position.set(-3.6 + i * 1.08, 3.7 + Math.sin(i) * .55, -3.42);
    group.add(node);
  }
  const experienceInfo = makeInfoPanel(
    `Experience / ${experience.start_date}–${experience.end_date}`,
    experience.title,
    [experience.company, `${experience.location} · ${experience.description}`],
    '#ff7a68', 4.75, 3.05,
  );
  experienceInfo.position.set(2.05, 3.18, -3.54);
  group.add(experienceInfo);
}

function createProjects(index) {
  const { group, accent } = addRoomShell(index, 'PROJECT LAB');
  box(5.8, .22, 1.7, mat(0x6f4938), .8, 1.28, -2.25, group);
  for (const x of [-1.8, 3.35]) box(.22, 1.15, .22, mat(0x171d2a), x, .65, -2.25, group);
  box(2.7, 1.75, .16, mat(0x0a0f19, .34, .65), .8, 2.45, -2.58, group);
  workstationScreen = new THREE.Mesh(new THREE.PlaneGeometry(2.38, 1.4), new THREE.MeshBasicMaterial({ color: 0x10291f, toneMapped: false }));
  workstationScreen.position.set(.8, 2.45, -2.48);
  group.add(workstationScreen);
  box(.16, .75, .16, mat(0x222938), .8, 1.58, -2.55, group);
  box(1.15, .08, .5, accent, .8, 1.32, -2.2, group);
  box(1.25, .12, 1.05, mat(0x26314b), .95, .78, -.85, group);
  box(.2, 1.5, .2, mat(0x171d2a), .95, .1, -.85, group);
  for (let i = 0; i < 4; i++) box(.6, .12 + i * .02, .85, mat([0xff7a68, 0x6fffd8, 0x9d88ff, 0xffcc5c][i]), -3.2, .38 + i * .14, -2.65, group);
  const projectInfo = makeInfoPanel(
    `Project Lab / ${portfolio.projects.length} builds`,
    'Choose a project',
    portfolio.projects.slice(0, 4).map((project) => `${project.title} · ${project.year}`),
    '#6fffd8', 4.25, 3.2,
  );
  projectInfo.position.set(-2.48, 3.2, -3.54);
  group.add(projectInfo);
}

function createSkills(index) {
  const { group, accent } = addRoomShell(index, 'SKILLS');
  portfolio.skills.forEach((skill, i) => {
    const logo = makeSkillLogo(skill, i);
    const column = i % 5;
    const row = Math.floor(i / 5);
    logo.position.set(-3.65 + column * 1.82, 1.2 + row * 1.22 + (column % 2) * .16, -1.95 + (i % 3) * .72);
    logo.rotation.y = (column - 2) * -.045;
    logo.userData = {
      kind: 'skill-logo',
      baseX: logo.position.x,
      baseY: logo.position.y,
      speed: .72 + (i % 5) * .12,
      phase: i * .73,
    };
    group.add(logo);
    animatedObjects.push(logo);
  });
  const pedestal = box(3.5, .45, 2.1, mat(0x172139), 0, .3, -.2, group);
  pedestal.rotation.y = .08;
  box(2.4, .07, 1.2, accent, 0, .57, -.2, group);
  const skillNames = portfolio.skills.map((skill) => skill.name);
  const skillsInfo = makeInfoPanel(
    `Skills / ${skillNames.length} tools`,
    'Technical toolkit',
    [skillNames.slice(0, 6).join(' · '), skillNames.slice(6, 11).join(' · '), skillNames.slice(11).join(' · ')],
    '#9d88ff', 5.8, 3.05,
  );
  skillsInfo.position.set(.8, 3.3, -3.54);
  group.add(skillsInfo);
}

function createEducation(index) {
  const { group } = addRoomShell(index, 'EDUCATION');
  const [masters, bachelors] = portfolio.education;
  for (let shelf = 0; shelf < 3; shelf++) {
    box(4.2, .14, .65, mat(0x7b4e38), 1.8, 1.05 + shelf * 1.28, -3.15, group);
    for (let book = 0; book < 9; book++) {
      const height = .62 + (book % 3) * .12;
      box(.25 + (book % 2) * .06, height, .5, mat([0xc8ff3d, 0xff7a68, 0x6a83c8, 0x9d88ff][book % 4]), .05 + book * .42, 1.14 + shelf * 1.28 + height / 2, -3.05, group);
    }
  }
  box(3.4, .16, 2.1, mat(0x835740), -1.8, 1.2, -.6, group);
  for (const x of [-3.15, -.45]) box(.18, 1.15, .18, mat(0x171d2a), x, .63, -.6, group);
  const openBook = box(1.2, .06, .85, mat(0xf2ead5), -1.8, 1.35, -.6, group);
  openBook.rotation.z = -.08;
  const educationInfo = makeInfoPanel(
    `Education / ${masters.start_year}–${masters.end_year}`,
    masters.degree,
    [masters.school, `${masters.details} · ${masters.location}`, `${bachelors.degree} · ${bachelors.school}`],
    '#ffcc5c', 4.6, 3.2,
  );
  educationInfo.position.set(-2.35, 3.25, -3.54);
  group.add(educationInfo);
}

function createResearch(index) {
  const { group, accent } = addRoomShell(index, 'RESEARCH');
  const paper = portfolio.research[0];
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(.3, .48, 2.5, 18), mat(0x7383a5, .35, .65));
  tube.rotation.z = Math.PI / 2.6;
  tube.position.set(1.6, 3.1, -1.5);
  group.add(tube);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(.4, .4, .16, 20), new THREE.MeshStandardMaterial({ color: 0x6fffd8, emissive: 0x1b806d, emissiveIntensity: 1.2 }));
  lens.rotation.z = Math.PI / 2.6;
  lens.position.set(.67, 3.93, -1.5);
  group.add(lens);
  box(.17, 2.5, .17, mat(0x353e50), 1.75, 1.45, -1.5, group);
  for (let i = 0; i < 13; i++) {
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(.06 + (i % 3) * .035), accent);
    star.position.set(-4.2 + (i % 5) * 1.75, 2.1 + Math.floor(i / 5) * 1.3 + Math.sin(i) * .35, -3.35);
    star.userData = { baseY: star.position.y, speed: .8, phase: i };
    group.add(star);
    animatedObjects.push(star);
  }
  box(3.5, .14, 1.45, mat(0x53617d), -1.55, 1.15, -1.7, group);
  const researchInfo = makeInfoPanel(
    `IEEE Research / ${paper.year}`,
    'CNN training study',
    [paper.title, paper.abstract, paper.technologies],
    '#66b7ff', 4.9, 3.3,
  );
  researchInfo.position.set(-2.1, 3.2, -3.54);
  group.add(researchInfo);
}

function createContact(index) {
  const { group, accent } = addRoomShell(index, 'CONTACT');
  box(3.7, .7, 1.4, mat(0x394b72), 1.3, .78, -2.4, group);
  box(3.7, 1.25, .42, mat(0x435981), 1.3, 1.53, -3.0, group);
  box(.5, .92, 1.42, mat(0x435981), -.8, 1.15, -2.4, group);
  box(.5, .92, 1.42, mat(0x435981), 3.4, 1.15, -2.4, group);
  box(2.5, .13, 1.2, mat(0x83604a), -.5, .7, .2, group);
  box(.18, .66, .18, mat(0x171d2a), -.5, .35, .2, group);
  const mail = box(1.1, .72, .09, accent, -.5, 1.08, -.34, group);
  mail.rotation.x = -.15;
  const plantStem = box(.08, 1.6, .08, mat(0x4b9c68), -3.6, 1.2, -2.7, group);
  plantStem.rotation.z = -.12;
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(.28, 12, 8), mat(0x4ea873));
    leaf.scale.set(1.5, .55, .7);
    leaf.position.set(-3.6 + (i % 2 ? .28 : -.28), 1 + i * .28, -2.7);
    group.add(leaf);
  }
  const featuredCredentials = portfolio.certifications.slice(0, 3).map((certificate) => `${certificate.title} · ${certificate.year}`);
  const contactInfo = makeInfoPanel(
    'Contact / Credentials',
    'Let’s build what’s next',
    [portfolio.email, ...featuredCredentials, 'LinkedIn /in/abhipy · GitHub /Abhi-VIT'],
    '#c8ff3d', 4.75, 3.35,
  );
  contactInfo.position.set(-2.15, 3.15, -3.54);
  group.add(contactInfo);
}

createFoyer(0);
createExperience(1);
createProjects(2);
createSkills(3);
createEducation(4);
createResearch(5);
createContact(6);

function createGuide() {
  const root = new THREE.Group();
  root.name = 'portfolio-presenter';
  const status = document.querySelector('#guideModelStatus');
  const message = status.querySelector('span');
  const retry = status.querySelector('button');
  const loader = new GLTFLoader();
  let loading = false;

  function loadModel() {
    if (loading || root.children.length) return;
    loading = true;
    status.hidden = false;
    retry.hidden = true;
    message.textContent = 'Loading your 3D guide…';
    canvas.dataset.guideState = 'loading';
    loader.load(canvas.dataset.guideModel, (gltf) => {
      const presenter = createWalkingPresenter(gltf.scene);
      root.add(fitGuideModel(presenter, GUIDE_RADIUS));
      root.userData.updateWalk = presenter.userData.updateWalk;
      canvas.dataset.guideState = 'ready';
      status.hidden = true;
      loading = false;
    }, undefined, (error) => {
      console.error('Unable to load the presenter model:', error);
      canvas.dataset.guideState = 'error';
      message.textContent = 'The guide could not load. You can still explore every room.';
      retry.hidden = false;
      loading = false;
    });
  }
  retry.addEventListener('click', loadModel);
  loadModel();
  return root;
}
const guide = createGuide();
scene.add(guide);
guide.position.set(destination(0).x, .17, destination(0).z);
// Include the rotated skill pedestal and the telescope's wider upper body.
guideObstacles.push({ minX: 3 * roomGap - 1.85, maxX: 3 * roomGap + 1.85, minZ: -1.4, maxZ: .99 });
guideObstacles.push({ minX: 5 * roomGap + .35, maxX: 5 * roomGap + 3, minZ: -2.05, maxZ: -.95 });
const guideNavigator = createNavigator(guideObstacles);
let guidePath = [];
let guideDestinationRoom = 0;

for (let i = 0; i < 30; i++) {
  const spark = new THREE.Mesh(new THREE.OctahedronGeometry(.018 + Math.random() * .038), mat(i % 5 === 0 ? 0xc8ff3d : 0x7182ac));
  spark.position.set((Math.random() - .05) * roomGap * 7, 1 + Math.random() * 10, (Math.random() - .5) * 18);
  scene.add(spark);
}

const projects = JSON.parse(document.querySelector('#project-data').textContent);
function update3DScreen(project) {
  if (!workstationScreen) return;
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 900;
  screenCanvas.height = 530;
  const context = screenCanvas.getContext('2d');
  context.fillStyle = '#07150f';
  context.fillRect(0, 0, 900, 530);
  context.strokeStyle = '#c8ff3d';
  context.lineWidth = 5;
  context.strokeRect(18, 18, 864, 494);
  context.fillStyle = '#c8ff3d';
  context.font = '26px monospace';
  context.fillText(`PROJECT / ${project.year}`, 52, 74);
  context.fillStyle = '#f5f1e8';
  context.font = '700 48px sans-serif';
  const words = project.title.split(' ');
  let line = '';
  let y = 155;
  words.forEach(word => {
    const testLine = `${line}${word} `;
    if (context.measureText(testLine).width > 760) { context.fillText(line, 52, y); line = `${word} `; y += 58; }
    else line = testLine;
  });
  context.fillText(line, 52, y);
  context.fillStyle = '#6fffd8';
  context.font = '22px monospace';
  context.fillText(project.tech.slice(0, 62).toUpperCase(), 52, 450);
  const texture = new THREE.CanvasTexture(screenCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (workstationScreen.material.map) workstationScreen.material.map.dispose();
  workstationScreen.material.map = texture;
  workstationScreen.material.color.set(0xffffff);
  workstationScreen.material.needsUpdate = true;
}
update3DScreen(projects[0]);

const screenYear = document.querySelector('#screenYear');
const screenTitle = document.querySelector('#screenTitle');
const screenDescription = document.querySelector('#screenDescription');
const screenTech = document.querySelector('#screenTech');
const screenLink = document.querySelector('#screenLink');
const projectDialog = document.querySelector('#projectDialog');
let selectedProject = 0;
function selectProject(index) {
  selectedProject = index;
  const project = projects[index];
  screenYear.textContent = `${project.year} / PROJECT 0${index + 1}`;
  screenTitle.textContent = project.title;
  screenDescription.textContent = project.description;
  screenTech.textContent = project.tech;
  screenLink.href = project.link || '#';
  screenLink.setAttribute('aria-disabled', String(!project.link));
  document.querySelectorAll('.project-tab').forEach((tab, tabIndex) => tab.classList.toggle('is-selected', tabIndex === index));
  update3DScreen(project);
}
document.querySelectorAll('.project-tab').forEach(tab => tab.addEventListener('click', () => selectProject(Number(tab.dataset.project))));
document.querySelector('#projectDetails').addEventListener('click', () => {
  const project = projects[selectedProject];
  document.querySelector('#dialogYear').textContent = project.year;
  document.querySelector('#dialogTitle').textContent = project.title;
  document.querySelector('#dialogDescription').textContent = project.description;
  document.querySelector('#dialogTech').innerHTML = project.tech.split(',').map(tech => `<span>${tech.trim()}</span>`).join('');
  const link = document.querySelector('#dialogLink');
  link.href = project.link || '#';
  link.hidden = !project.link;
  projectDialog.showModal();
});
document.querySelector('.dialog-close').addEventListener('click', () => projectDialog.close());
projectDialog.addEventListener('click', event => { if (event.target === projectDialog) projectDialog.close(); });

let roomIndex = 0;
let targetRoom = 0;
let lookYaw = 0;
let lookPitch = 0;
let isLooking = false;
let lastPointerX = 0;
let lastPointerY = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const guideLine = document.querySelector('#guideLine');
const guideBubble = document.querySelector('#guideBubble');
const railLinks = [...document.querySelectorAll('.room-dot')];
const stops = [...document.querySelectorAll('.tour-stop')];
const soundButton = document.querySelector('#soundToggle');
const fppRoomLabel = document.querySelector('#fppRoomLabel');
const roomLabels = ['WELCOME', 'EXPERIENCE', 'PROJECT LAB', 'SKILLS', 'EDUCATION', 'RESEARCH', 'CONTACT'];

function speakLine(line) {
  if (soundButton.getAttribute('aria-pressed') !== 'true' || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(line);
  utterance.rate = .96;
  utterance.pitch = 1.03;
  speechSynthesis.speak(utterance);
}
function activateRoom(index, line) {
  if (index !== targetRoom) {
    document.body.classList.add('is-room-transitioning');
    window.clearTimeout(activateRoom.transitionTimer);
    activateRoom.transitionTimer = window.setTimeout(() => document.body.classList.remove('is-room-transitioning'), 900);
  }
  targetRoom = index;
  document.body.classList.toggle('presentation-right', index === 4 || index === 6);
  stops.forEach((stop, stopIndex) => stop.classList.toggle('is-current', stopIndex === index));
  fppRoomLabel.textContent = `0${index} / ${roomLabels[index]}`;
  railLinks.forEach((link, i) => link.classList.toggle('is-active', i === index));
  if (line && guideLine.textContent !== line) {
    guideBubble.classList.remove('is-talking');
    requestAnimationFrame(() => {
      guideLine.textContent = line;
      guideBubble.classList.add('is-talking');
      speakLine(line);
      setTimeout(() => guideBubble.classList.remove('is-talking'), 900);
    });
  }
}
const observer = new IntersectionObserver((entries) => {
  const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (visible) activateRoom(Number(visible.target.dataset.room), visible.target.dataset.guide);
}, { threshold: [.35, .55, .72] });
stops.forEach(stop => observer.observe(stop));

let autoTimer;
document.querySelector('#autoTour').addEventListener('click', () => {
  clearInterval(autoTimer);
  let index = 1;
  stops[index].scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  autoTimer = setInterval(() => {
    // Let the guide finish the visible walk before advancing the camera again.
    const stop = destination(index);
    if (Math.hypot(guide.position.x - stop.x, guide.position.z - stop.z) > .05) return;
    index += 1;
    if (index >= stops.length) return clearInterval(autoTimer);
    stops[index].scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  }, 5200);
});
addEventListener('wheel', () => clearInterval(autoTimer), { passive: true });
addEventListener('touchstart', () => clearInterval(autoTimer), { passive: true });

soundButton.addEventListener('click', () => {
  const enabled = soundButton.getAttribute('aria-pressed') !== 'true';
  soundButton.setAttribute('aria-pressed', String(enabled));
  soundButton.querySelector('.sound-label').textContent = enabled ? 'VOICE ON' : 'VOICE OFF';
  if (enabled) speakLine(guideLine.textContent);
  else if ('speechSynthesis' in window) speechSynthesis.cancel();
});

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', onResize);
document.addEventListener('pointerdown', (event) => {
  if (event.target.closest('a, button, dialog, .room-card, .guide-bubble')) return;
  isLooking = true;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  document.body.classList.add('is-looking');
});
document.addEventListener('pointermove', (event) => {
  if (!isLooking) return;
  lookYaw = THREE.MathUtils.clamp(lookYaw - (event.clientX - lastPointerX) * .0025, -.6, .6);
  lookPitch = THREE.MathUtils.clamp(lookPitch + (event.clientY - lastPointerY) * .002, -.28, .3);
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
});
document.addEventListener('pointerup', () => {
  isLooking = false;
  document.body.classList.remove('is-looking');
});
document.addEventListener('keydown', (event) => {
  if (event.target.matches('button, a, input, textarea')) return;
  if (['ArrowDown', 'ArrowRight', 'KeyW', 'KeyD'].includes(event.code)) {
    event.preventDefault();
    stops[Math.min(targetRoom + 1, stops.length - 1)].scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  }
  if (['ArrowUp', 'ArrowLeft', 'KeyS', 'KeyA'].includes(event.code)) {
    event.preventDefault();
    stops[Math.max(targetRoom - 1, 0)].scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  }
});

const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(clock.getDelta(), .05);
  const t = clock.elapsedTime;
  roomIndex += (targetRoom - roomIndex) * (reducedMotion ? .16 : .028);
  const targetX = roomIndex * roomGap;
  const walking = Math.abs(targetRoom - roomIndex) > .035;
  const movementDirection = Math.sign(targetRoom - roomIndex) || 1;
  // Present beside the furniture; use collision-safe routes between rooms.
  if (targetRoom !== guideDestinationRoom) {
    const route = guideNavigator.route({ x: guide.position.x, z: guide.position.z }, destination(targetRoom));
    // If an asset ever blocks the route, stay put instead of walking through it.
    guidePath = route || [];
    guideDestinationRoom = targetRoom;
  }
  let moved = 0;
  let desiredFacing = Math.atan2(camera.position.x - guide.position.x, camera.position.z - guide.position.z);
  const nextWaypoint = guidePath[0];
  if (nextWaypoint) {
    const dx = nextWaypoint.x - guide.position.x;
    const dz = nextWaypoint.z - guide.position.z;
    const distance = Math.hypot(dx, dz);
    desiredFacing = Math.atan2(dx, dz);
    const waitingForGate = guideDoors.some((door, index) => {
      const gateX = index * roomGap + 4.86;
      const approaching = (gateX - guide.position.x) * dx > 0;
      return approaching && Math.abs(gateX - guide.position.x) < 1.35 && Math.abs(guide.position.z + 1.7) < .3 && door.userData.openAmount < .8;
    });
    if (!waitingForGate && distance > .001) {
      moved = Math.min(distance, dt * 2.3);
      guide.position.x += dx / distance * moved;
      guide.position.z += dz / distance * moved;
    }
    if (distance <= moved + .001) guidePath.shift();
  }
  const turnError = Math.atan2(Math.sin(desiredFacing - guide.rotation.y), Math.cos(desiredFacing - guide.rotation.y));
  guide.rotation.y += turnError * (1 - Math.exp(-dt * 10));
  guide.userData.updateWalk?.({ distance: moved, dt, reducedMotion });
  // The runtime leg rig corrects the shoe soles against this floor height.
  guide.position.y = .17;
  const cameraBob = walking && !reducedMotion ? Math.sin(t * 8) * .035 : 0;
  camera.position.x += (targetX - camera.position.x) * .055;
  camera.position.y += ((1.95 + cameraBob) - camera.position.y) * .09;
  camera.position.z += ((3.1 + (walking ? Math.sin(t * 4) * .05 : 0)) - camera.position.z) * .08;
  keyLight.position.x = camera.position.x + 5;
  keyLight.target.position.set(camera.position.x, 1.2, -1);
  viewerRig.position.y = walking && !reducedMotion ? Math.sin(t * 8) * .025 : 0;
  viewerRig.rotation.z = walking && !reducedMotion ? Math.sin(t * 4) * .008 : 0;
  const lookDirection = new THREE.Vector3(Math.sin(lookYaw), lookPitch, -Math.cos(lookYaw));
  camera.lookAt(camera.position.clone().add(lookDirection.multiplyScalar(8)));
  doors.forEach((door) => {
    const doorPosition = new THREE.Vector3();
    door.getWorldPosition(doorPosition);
    const cameraNear = Math.abs(camera.position.x - doorPosition.x) < 3.25;
    const shouldOpen = walking && cameraNear;
    if (shouldOpen) door.userData.openDirection = movementDirection;
    door.userData.openAmount += ((shouldOpen ? 1 : 0) - door.userData.openAmount) * .12;
    const easedOpen = 1 - Math.pow(1 - door.userData.openAmount, 3);
    door.rotation.y = door.userData.openDirection * -Math.PI * .52 * easedOpen;
  });
  guideDoors.forEach((door) => {
    const doorPosition = new THREE.Vector3();
    door.getWorldPosition(doorPosition);
    const guideNear = Math.abs(guide.position.x - doorPosition.x) < 2.8 && Math.abs(guide.position.z + 1.7) < 1;
    const shouldOpen = guidePath.length > 0 && guideNear;
    if (shouldOpen && Math.abs(guide.position.x - doorPosition.x) > 1.4) door.userData.openDirection = Math.sign(doorPosition.x - guide.position.x);
    door.userData.openAmount += ((shouldOpen ? 1 : 0) - door.userData.openAmount) * .14;
    const easedOpen = 1 - Math.pow(1 - door.userData.openAmount, 3);
    door.rotation.y = door.userData.openDirection * -Math.PI * .54 * easedOpen;
  });
  animatedObjects.forEach((item) => {
    if (reducedMotion) return;
    item.position.y = item.userData.baseY + Math.sin(t * item.userData.speed + item.userData.phase) * .22;
    if (item.userData.kind === 'skill-logo') {
      item.position.x = item.userData.baseX + Math.cos(t * item.userData.speed * .7 + item.userData.phase) * .1;
      item.rotation.x = Math.sin(t * item.userData.speed + item.userData.phase) * .065;
      item.rotation.y = Math.cos(t * item.userData.speed * .8 + item.userData.phase) * .14;
    } else {
      item.rotation.x += .004;
      item.rotation.y += .006;
    }
  });
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
