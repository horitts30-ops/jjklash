import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
export const IS_WEBKIT = (() => { try { const u = navigator.userAgent; return /iP(hone|ad|od)/.test(u) || (/Safari\//.test(u) && !/Chrome|Chromium|Android|Edg|OPR/.test(u)) || (navigator.vendor === 'Apple Computer, Inc.' && !/Chrome|Chromium/.test(u)); } catch (er) { return false; } })();
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const FinalShader = {
  uniforms: { tDiffuse: { value: null }, uAb: { value: 0 }, uVig: { value: 0.42 }, uTint: { value: new THREE.Vector3(0, 0, 0) }, uTime: { value: 0 }, uWarp: { value: 0 }, uRes: { value: new THREE.Vector2(1280, 720) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `
  uniform sampler2D tDiffuse; uniform float uAb, uVig, uTime, uWarp; uniform vec3 uTint; uniform vec2 uRes; varying vec2 vUv;
  void main(){
    vec2 c=vUv-0.5; float d=length(c);
    vec2 uv=vUv + c*uWarp*sin(d*18.0-uTime*14.0)*0.02;
    vec2 off=c*uAb*(0.4+d);
    vec3 col=vec3(texture2D(tDiffuse,uv+off).r, texture2D(tDiffuse,uv).g, texture2D(tDiffuse,uv-off).b);
    // photographic grade: gentle filmic contrast, lifted blacks, restrained saturation, warm highlights / cool shadows, tiny lens softness
    float lum=dot(col,vec3(.299,.587,.114));
    col=mix(vec3(lum),col,0.94);
    vec3 cc=clamp(col,0.0,1.0); col=cc*cc*(3.0-2.0*cc)*0.35+cc*0.65+max(col-1.0,0.0);
    col=max(col,0.0)+0.006;
    col=mix(col*vec3(0.95,0.98,1.04), col*vec3(1.03,1.0,0.96), smoothstep(0.05,0.9,lum));
    col*=1.0-uVig*smoothstep(0.25,0.9,d);
    float gr=fract(sin(dot(vUv*uRes+uTime,vec2(12.9898,78.233)))*43758.5453); col+= (gr-0.5)*0.006;
    
    col=mix(col, col*uTint*2.0+uTint*0.15, min(1.0,length(uTint)));
    gl_FragColor=vec4(col,1.0);
  }`,
};

export function createEngine(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const pm = new THREE.PMREMGenerator(renderer);
  const envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;

  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: IS_WEBKIT ? 0 : 4 });
  const composer = new EffectComposer(renderer, rt);
  const rp = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.28, 0.55, 1.05);
  const fin = new ShaderPass(FinalShader);
  const out = new OutputPass(); const fxaa = new ShaderPass(FXAAShader); fxaa.enabled = IS_WEBKIT;
  let gtao = null; if (false) try { gtao = new GTAOPass(rp.scene, rp.camera, 512, 512); gtao.output = GTAOPass.OUTPUT.Default; gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.4, thickness: 1.6, scale: 1.25, samples: 12, distanceFallOff: 1, screenSpaceRadius: false }); gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 }); gtao.blendIntensity = 0.85; } catch (err) { gtao = null; }
  composer.addPass(rp); composer.addPass(bloom); composer.addPass(fin); composer.addPass(out); composer.addPass(fxaa);

  const eng = {
    renderer, composer, bloom, fin, envTex, gtao, quality: 'high', time: 0,
    resize() {
      const q = eng.quality, dpr = Math.min(window.devicePixelRatio || 1, q === 'high' ? 1.5 : q === 'med' ? 1.1 : 0.85);
      renderer.setPixelRatio(dpr);
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h, false); composer.setPixelRatio(dpr); composer.setSize(w, h);
      eng.size = { w, h, dpr }; try { fxaa.material.uniforms['resolution'].value.set(1 / (w * dpr), 1 / (h * dpr)); } catch (er) { }
    },
    setQuality(q) {
      eng.quality = q; renderer.shadowMap.enabled = q !== 'low'; bloom.enabled = q !== 'low'; if (gtao) gtao.enabled = q === 'high';
      rt.samples = IS_WEBKIT ? 0 : q === 'high' ? 2 : 0; composer.renderTarget1.samples = rt.samples; composer.renderTarget2.samples = rt.samples;
      eng.onQuality && eng.onQuality(q); eng.resize();
    },
    render(scene, camera) { const nowT = performance.now(); if (eng._lt) { const d = nowT - eng._lt; if (d < 250) eng._ema = (eng._ema || 16) * 0.95 + d * 0.05; if (eng._ema > 30 && eng.quality !== 'low' && (eng._slow = (eng._slow || 0) + 1) > 120) { eng._slow = 0; eng._ema = 16; eng.setQuality(eng.quality === 'high' ? 'med' : 'low'); eng.onAuto && eng.onAuto(eng.quality); } else if (eng._ema <= 30) eng._slow = 0; } eng._lt = nowT; rp.scene = scene; rp.camera = camera; if (gtao) { gtao.scene = scene; gtao.camera = camera; } fin.uniforms.uTime.value = eng.time; composer.render(); },
  };
  window.addEventListener('resize', eng.resize);
  eng.resize();
  return eng;
}

export function makeSky(top, horizon, sunDir, sunColor, stars = false) {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, hor: { value: new THREE.Color(horizon) }, sunDir: { value: sunDir.clone().normalize() }, sunCol: { value: new THREE.Color(sunColor) }, stars: { value: stars ? 1 : 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; uniform vec3 top,hor,sunDir,sunCol; uniform float stars;
    float h(vec3 p){ p=fract(p*vec3(443.8,397.3,491.1)); p+=dot(p,p.yzx+19.19); return fract((p.x+p.y)*p.z); }
    void main(){ vec3 d=normalize(vP); float t=pow(clamp(d.y*1.1+0.05,0.0,1.0),0.6);
      vec3 c=mix(hor,top,t); float s=max(dot(d,normalize(sunDir)),0.0);
      c+=sunCol*(pow(s,8.0)*0.35+pow(s,200.0)*3.0);
      if(stars>0.5 && d.y>0.0){ vec3 g=floor(d*220.0); float r=h(g); c+=vec3(step(0.9965,r))*smoothstep(0.0,0.4,d.y)*1.3; }
      gl_FragColor=vec4(c,1.0); }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), m);
  mesh.frustumCulled = false; mesh.renderOrder = -10;
  return mesh;
}

export function makeLights(scene, cfg) {
  const sun = new THREE.DirectionalLight(cfg.sunColor, cfg.sunInt * 0.85);
  sun.castShadow = true;
  const S = cfg.shadowSize || 38;
  Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 160 });
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.05; sun.shadow.radius = 2.5;
  const dir = cfg.sunDir.clone().normalize();
  const hemi = new THREE.HemisphereLight(cfg.skyColor, cfg.groundColor, cfg.hemiInt * 0.9);
  scene.add(sun, sun.target, hemi);
  scene.userData.sunDir = dir;
  const follow = (p) => {
    // snap the shadow camera to whole shadow-map texels in light space so shadow edges don't crawl or shimmer
    const texel = (2 * S) / 2048, rgt = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize(), up = new THREE.Vector3().crossVectors(dir, rgt).normalize();
    const b = (p.x * rgt.x + p.z * rgt.z), c = (p.x * up.x + p.y * up.y + p.z * up.z);
    const sa = Math.round(b / texel) * texel, sb = Math.round(c / texel) * texel;
    sun.target.position.set(p.x, 0, p.z).addScaledVector(rgt, sa - b).addScaledVector(up, sb - c);
    sun.position.copy(sun.target.position).addScaledVector(dir, 90);
  };
  follow(new THREE.Vector3());
  return { sun, hemi, follow };
}
