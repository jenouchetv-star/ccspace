/* Chike's Creative Space - PixelBlast, a plain-JavaScript version of the React Bits component (reactbits.dev,
   "PixelBlast", JavaScript + CSS variant). A WebGL2 field of dithered pixels that drifts, twinkles, ripples where you
   click and brightens under the pointer. Used behind the Starter Pack's cover.

     const stop = createPixelBlast(containerEl, { color:"#1273B0", variant:"square", ... });
     stop();   // removes listeners and frees the GPU objects

   The container should be position:relative with a size; the canvas fills it. Options are the component's props,
   with the same names and defaults. Without WebGL2 (or with prefers-reduced-motion) it degrades to a still frame or
   nothing at all, never an error. */
(function(){
  "use strict";

  var MAX_CLICKS = 10;
  var INTRO_SECONDS = 1.8;
  var SHAPES = { square: 0, circle: 1, triangle: 2, diamond: 3, cross: 4, ring: 5 };
  var HOVERS = { none: 0, grow: 1, reveal: 2 };
  var bayer2 = function(x, y){ return (Math.floor(x) / 2 + Math.floor(y) * Math.floor(y) * 0.75) % 1; };
  var bayer8 = function(x, y){ return (bayer2(x / 4, y / 4) * 0.25 + bayer2(x / 2, y / 2)) * 0.25 + bayer2(x, y); };
  var BAYER_TABLE = Array.from({ length: 64 }, function(_, i){ return bayer8(i % 8, Math.floor(i / 8)).toFixed(6); }).join(", ");
  var RANGE_MIN = -6;
  var RANGE_MAX = 10;

  var VERTEX = "#version 300 es\n"
    + "void main() {\n"
    + "  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));\n"
    + "  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);\n"
    + "}";

  var PACKING = "\n"
    + "const float RANGE_MIN = " + RANGE_MIN.toFixed(1) + ";\n"
    + "const float RANGE_MAX = " + RANGE_MAX.toFixed(1) + ";\n"
    + "vec2 pack16(float value) {\n"
    + "  float x = floor(clamp((value - RANGE_MIN) / (RANGE_MAX - RANGE_MIN), 0.0, 1.0) * 65535.0 + 0.5);\n"
    + "  float hi = floor(x / 256.0);\n"
    + "  return vec2(hi, x - hi * 256.0) / 255.0;\n"
    + "}\n"
    + "float unpack16(vec2 c) {\n"
    + "  float x = floor(c.x * 255.0 + 0.5) * 256.0 + floor(c.y * 255.0 + 0.5);\n"
    + "  return RANGE_MIN + x / 65535.0 * (RANGE_MAX - RANGE_MIN);\n"
    + "}\n";

  var CELL_FRAGMENT = "#version 300 es\n"
    + "precision highp float;\nprecision highp int;\n"
    + "uniform vec2 uResolution;\nuniform float uTime;\nuniform float uPixelSize;\nuniform float uScale;\nuniform float uDensity;\n"
    + "uniform int uEnableRipples;\nuniform float uRippleSpeed;\nuniform float uRippleThickness;\nuniform float uRippleIntensity;\n"
    + "uniform vec2 uClickPos[" + MAX_CLICKS + "];\nuniform float uClickAge[" + MAX_CLICKS + "];\n"
    + "uniform ivec2 uOrigin;\nuniform vec2 uDrift;\nuniform int uHover;\nuniform vec2 uMouse;\nuniform float uMouseRadius;\n"
    + "uniform float uMousePresence;\nuniform float uIntro;\nuniform sampler2D uPrev;\nuniform float uDecay;\nuniform float uFresh;\n"
    + "out vec4 outCell;\n" + PACKING
    + "float hash11(float n) { return fract(sin(n) * 43758.5453); }\n"
    + "float vnoise(vec3 p) {\n"
    + "  vec3 ip = floor(p);\n  vec3 fp = fract(p);\n"
    + "  float n000 = hash11(dot(ip + vec3(0.0, 0.0, 0.0), vec3(1.0, 57.0, 113.0)));\n"
    + "  float n100 = hash11(dot(ip + vec3(1.0, 0.0, 0.0), vec3(1.0, 57.0, 113.0)));\n"
    + "  float n010 = hash11(dot(ip + vec3(0.0, 1.0, 0.0), vec3(1.0, 57.0, 113.0)));\n"
    + "  float n110 = hash11(dot(ip + vec3(1.0, 1.0, 0.0), vec3(1.0, 57.0, 113.0)));\n"
    + "  float n001 = hash11(dot(ip + vec3(0.0, 0.0, 1.0), vec3(1.0, 57.0, 113.0)));\n"
    + "  float n101 = hash11(dot(ip + vec3(1.0, 0.0, 1.0), vec3(1.0, 57.0, 113.0)));\n"
    + "  float n011 = hash11(dot(ip + vec3(0.0, 1.0, 1.0), vec3(1.0, 57.0, 113.0)));\n"
    + "  float n111 = hash11(dot(ip + vec3(1.0, 1.0, 1.0), vec3(1.0, 57.0, 113.0)));\n"
    + "  vec3 w = fp * fp * fp * (fp * (fp * 6.0 - 15.0) + 10.0);\n"
    + "  float x00 = mix(n000, n100, w.x);\n  float x10 = mix(n010, n110, w.x);\n"
    + "  float x01 = mix(n001, n101, w.x);\n  float x11 = mix(n011, n111, w.x);\n"
    + "  float y0 = mix(x00, x10, w.y);\n  float y1 = mix(x01, x11, w.y);\n"
    + "  return mix(y0, y1, w.z) * 2.0 - 1.0;\n"
    + "}\n"
    + "float fbm2(vec2 uv, float t) {\n"
    + "  vec3 p = vec3(uv * uScale, t);\n  float amp = 1.0;\n  float freq = 1.0;\n  float sum = 1.0;\n"
    + "  for (int i = 0; i < 5; ++i) { sum += amp * vnoise(p * freq); freq *= 1.25; amp *= 1.0; }\n"
    + "  return sum * 0.5 + 0.5;\n"
    + "}\n"
    + "void main() {\n"
    + "  ivec2 texel = ivec2(gl_FragCoord.xy);\n"
    + "  float aspectRatio = uResolution.x / uResolution.y;\n"
    + "  float cellPixelSize = 8.0 * uPixelSize;\n"
    + "  vec2 cellId = vec2(texel + uOrigin);\n"
    + "  vec2 cellCoord = cellId * cellPixelSize;\n"
    + "  vec2 uv = cellCoord / uResolution * vec2(aspectRatio, 1.0);\n"
    + "  float base = fbm2(uv + uDrift, uTime * 0.05);\n"
    + "  base = base * 0.5 - 0.65;\n"
    + "  float feed = base + (uDensity - 0.5) * 0.3;\n"
    + "  if (uEnableRipples == 1) {\n"
    + "    for (int i = 0; i < " + MAX_CLICKS + "; ++i) {\n"
    + "      vec2 pos = uClickPos[i];\n"
    + "      if (pos.x < 0.0) continue;\n"
    + "      vec2 cuv = (((pos - uResolution * 0.5 - cellPixelSize * 0.5) / uResolution)) * vec2(aspectRatio, 1.0);\n"
    + "      float t = max(uClickAge[i], 0.0);\n"
    + "      float r = distance(uv, cuv);\n"
    + "      float waveR = uRippleSpeed * t;\n"
    + "      float ring = exp(-pow((r - waveR) / uRippleThickness, 2.0));\n"
    + "      float atten = exp(-1.0 * t) * exp(-10.0 * r);\n"
    + "      feed = max(feed, ring * atten * uRippleIntensity);\n"
    + "    }\n"
    + "  }\n"
    + "  if (uIntro < 1.0) {\n"
    + "    vec2 center = (-cellPixelSize * 0.5 / uResolution) * vec2(aspectRatio, 1.0);\n"
    + "    float reach = length(vec2(aspectRatio, 1.0)) * 0.5 + 0.2;\n"
    + "    float eased = 1.0 - pow(1.0 - uIntro, 2.4);\n"
    + "    float front = eased * reach;\n"
    + "    float r = distance(uv, center);\n"
    + "    float shown = smoothstep(front + 0.04, front - 0.06, r);\n"
    + "    float ring = exp(-pow((r - front) / 0.07, 2.0)) * (1.0 - uIntro);\n"
    + "    feed = mix(-1.0, feed, shown);\n"
    + "    feed = max(feed, ring * 1.4);\n"
    + "  }\n"
    + "  float brush = 0.0;\n"
    + "  if (uHover > 0) {\n"
    + "    vec2 d = (cellCoord + cellPixelSize * 0.5 + uResolution * 0.5 - uMouse) / max(uMouseRadius, 1.0);\n"
    + "    brush = exp(-dot(d, d)) * uMousePresence;\n"
    + "  }\n"
    + "  vec4 prev = texelFetch(uPrev, texel, 0) * (1.0 - uFresh);\n"
    + "  float trail = max(brush, max(prev.a * uDecay - 1.0 / 255.0, 0.0));\n"
    + "  if (uHover == 2) feed += trail * 0.9;\n"
    + "  outCell = vec4(pack16(feed), clamp((feed + 0.5) * 0.5, 0.0, 1.0), trail);\n"
    + "}";

  var MAIN_FRAGMENT = "#version 300 es\n"
    + "precision highp float;\nprecision highp int;\n"
    + "uniform vec3 uColor;\nuniform vec3 uAccent;\nuniform vec2 uResolution;\nuniform float uTime;\nuniform float uClock;\n"
    + "uniform float uPixelSize;\nuniform float uPixelJitter;\nuniform float uEdgeFade;\nuniform int uShapeType;\n"
    + "uniform sampler2D uCells;\nuniform ivec2 uOrigin;\nuniform ivec2 uCellCount;\nuniform float uSoftness;\n"
    + "uniform float uSmoothing;\nuniform float uGlow;\nuniform float uTwinkle;\nuniform float uLightMode;\n"
    + "uniform float uTransparent;\nuniform float uNoise;\nuniform int uHover;\nuniform mat3 uPlane;\nuniform float uTilted;\n"
    + "out vec4 fragColor;\n" + PACKING
    + "const float BAYER[64] = float[64](" + BAYER_TABLE + ");\n"
    + "vec2 gDx;\nvec2 gDy;\n"
    + "float aaFrom(vec2 grad) { return abs(dot(grad, gDx)) + abs(dot(grad, gDy)); }\n"
    + "float maskSquare(vec2 p, float cov, float soft) {\n"
    + "  if (soft <= 0.0) return cov;\n"
    + "  float side = 0.5 * sqrt(clamp(cov, 0.0, 1.0));\n"
    + "  vec2 c = p - 0.5;\n  vec2 q = abs(c) - side;\n  float d = max(q.x, q.y);\n"
    + "  vec2 grad = q.x > q.y ? vec2(sign(c.x), 0.0) : vec2(0.0, sign(c.y));\n"
    + "  float aa = max(aaFrom(grad), 1e-4);\n"
    + "  return 1.0 - smoothstep(-aa * 0.5, aa * 0.5, d);\n"
    + "}\n"
    + "float maskCircle(vec2 p, float cov) {\n"
    + "  float r = sqrt(cov) * 0.25;\n  vec2 c = p - 0.5;\n  float len = length(c);\n  float d = len - r;\n"
    + "  float aa = 0.5 * aaFrom(c / max(len, 1e-5));\n"
    + "  return cov * (1.0 - smoothstep(-aa, aa, d * 2.0));\n"
    + "}\n"
    + "float maskTriangle(vec2 p, vec2 id, float cov) {\n"
    + "  bool flip = mod(id.x + id.y, 2.0) > 0.5;\n  if (flip) p.x = 1.0 - p.x;\n"
    + "  float r = sqrt(cov);\n  float d = p.y - r * (1.0 - p.x);\n"
    + "  float aa = max(aaFrom(vec2(flip ? -r : r, 1.0)), 1e-4);\n"
    + "  return cov * clamp(0.5 - d / aa, 0.0, 1.0);\n"
    + "}\n"
    + "float maskDiamond(vec2 p, float cov) {\n"
    + "  float r = sqrt(cov) * 0.564;\n"
    + "  return step(abs(p.x - 0.49) + abs(p.y - 0.49), r);\n"
    + "}\n"
    + "float maskCross(vec2 p, float cov) {\n"
    + "  float s = sqrt(clamp(cov, 0.0, 1.0));\n  vec2 c = p - 0.5;\n  vec2 q = abs(c);\n"
    + "  float arm = 0.42 * s;\n  float bar = 0.13 * s + 0.02;\n"
    + "  float a1 = max(q.x - arm, q.y - bar);\n  float a2 = max(q.x - bar, q.y - arm);\n  float d = min(a1, a2);\n"
    + "  bool horizontal = a1 < a2 ? q.x - arm > q.y - bar : q.x - bar > q.y - arm;\n"
    + "  vec2 grad = horizontal ? vec2(sign(c.x), 0.0) : vec2(0.0, sign(c.y));\n"
    + "  float aa = max(aaFrom(grad), 1e-4);\n"
    + "  return 1.0 - smoothstep(-aa * 0.5, aa * 0.5, d);\n"
    + "}\n"
    + "float maskRing(vec2 p, float cov) {\n"
    + "  float s = sqrt(clamp(cov, 0.0, 1.0));\n  vec2 c = p - 0.5;\n  float len = length(c);\n"
    + "  float d = abs(len - 0.3 * s) - 0.09 * s;\n"
    + "  vec2 grad = sign(len - 0.3 * s) * c / max(len, 1e-5);\n"
    + "  float aa = max(aaFrom(grad), 1e-4);\n"
    + "  return 1.0 - smoothstep(-aa * 0.5, aa * 0.5, d);\n"
    + "}\n"
    + "float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n"
    + "void main() {\n"
    + "  float pixelSize = uPixelSize;\n"
    + "  vec2 screen = gl_FragCoord.xy;\n"
    + "  vec4 empty = uTransparent < 0.5 ? vec4(vec3(uLightMode > 0.5 ? 1.0 : 0.0), 1.0) : vec4(0.0);\n"
    + "  float lod = 0.0;\n  float depthFade = 1.0;\n"
    + "  if (uTilted > 0.5) {\n"
    + "    vec3 plane = uPlane * vec3(screen.x, uResolution.y - screen.y, 1.0);\n"
    + "    screen = vec2(plane.x, uResolution.y * plane.z - plane.y) / max(plane.z, 1e-4);\n"
    + "    float footprint = length(fwidth(screen));\n"
    + "    lod = smoothstep(0.3, 0.85, footprint / pixelSize);\n"
    + "    depthFade = (1.0 - smoothstep(0.45, 1.0, footprint / (8.0 * pixelSize))) * step(0.0, plane.z);\n"
    + "  }\n"
    + "  vec2 fragCoord = screen - uResolution * 0.5;\n"
    + "  gDx = dFdx(fragCoord) / pixelSize;\n  gDy = dFdy(fragCoord) / pixelSize;\n"
    + "  if (depthFade <= 0.0) { fragColor = empty; return; }\n"
    + "  float cellPixelSize = 8.0 * pixelSize;\n"
    + "  vec2 cellId = floor(fragCoord / cellPixelSize);\n"
    + "  ivec2 texel = clamp(ivec2(cellId) - uOrigin, ivec2(0), uCellCount - 1);\n"
    + "  vec2 smoothAt = (fragCoord / cellPixelSize - vec2(uOrigin)) / vec2(uCellCount);\n"
    + "  vec4 blended = texture(uCells, smoothAt);\n"
    + "  float smoothFeed = blended.b * 2.0 - 0.5;\n"
    + "  float feed = smoothFeed;\n"
    + "  float trail = uHover == 1 ? blended.a : 0.0;\n"
    + "  if (uSmoothing < 1.0) {\n"
    + "    vec4 cell = texelFetch(uCells, texel, 0);\n"
    + "    feed = mix(unpack16(cell.rg), smoothFeed, uSmoothing);\n"
    + "    if (uHover == 1) trail = mix(cell.a, blended.a, uSmoothing);\n"
    + "  }\n"
    + "  if (feed < -0.12 * uSoftness && smoothFeed < 0.2 && (lod <= 0.0 || smoothFeed <= 0.0)) { fragColor = empty; return; }\n"
    + "  vec2 pixelId = floor(fragCoord / pixelSize);\n"
    + "  vec2 pixelUV = fragCoord / pixelSize - pixelId;\n"
    + "  ivec2 cellBits = ivec2(mod(pixelId, 8.0));\n"
    + "  float bayer = BAYER[cellBits.y * 8 + cellBits.x] - 0.5;\n"
    + "  float margin = feed + bayer - 0.5;\n"
    + "  float bw = uSoftness > 0.0 ? smoothstep(-0.12 * uSoftness, 0.12 * uSoftness, margin) : step(0.0, margin);\n"
    + "  float h = uPixelJitter > 0.0 || uTwinkle > 0.0 ? fract(sin(dot(pixelId, vec2(127.1, 311.7))) * 43758.5453) : 0.5;\n"
    + "  float jitterScale = 1.0 + (h - 0.5) * uPixelJitter;\n"
    + "  float heat = max(trail, clamp((feed - 1.0) * 2.5, 0.0, 1.0) * min(uGlow * 2.0, 1.0));\n"
    + "  float coverage = bw * jitterScale * (1.0 + heat * 0.35);\n"
    + "  float M;\n  float area;\n"
    + "  if (uShapeType == 1) { M = maskCircle(pixelUV, coverage); area = 0.196; }\n"
    + "  else if (uShapeType == 2) { M = maskTriangle(pixelUV, pixelId, coverage); area = 0.5; }\n"
    + "  else if (uShapeType == 3) { M = maskDiamond(pixelUV, coverage); area = 0.62; }\n"
    + "  else if (uShapeType == 4) { M = maskCross(pixelUV, coverage); area = 0.41; }\n"
    + "  else if (uShapeType == 5) { M = maskRing(pixelUV, coverage); area = 0.41; }\n"
    + "  else { M = maskSquare(pixelUV, coverage, uSoftness); area = 1.0; }\n"
    + "  if (lod > 0.0) {\n"
    + "    float average = clamp(smoothFeed, 0.0, 1.0) * area * (1.0 + heat * 0.35);\n"
    + "    M = mix(M, average, lod);\n"
    + "  }\n"
    + "  if (uTwinkle > 0.0) {\n"
    + "    float rate = 1.5 + 3.0 * fract(h * 7.31);\n"
    + "    float wave = 0.5 + 0.5 * sin(uClock * rate + h * 37.0);\n"
    + "    M *= 1.0 - uTwinkle * 0.55 * wave * wave;\n"
    + "  }\n"
    + "  float density = clamp(smoothFeed, 0.0, 1.0);\n"
    + "  float glow = 0.0;\n"
    + "  if (uGlow > 0.0) {\n"
    + "    float bloom = smoothstep(0.2, 1.0, density);\n"
    + "    glow = bloom * bloom * uGlow * (uLightMode > 0.5 ? 0.12 : 0.22) * depthFade;\n"
    + "  }\n"
    + "  float fade = depthFade;\n"
    + "  if (uEdgeFade > 0.0) {\n"
    + "    vec2 norm = gl_FragCoord.xy / uResolution;\n"
    + "    vec2 edgeA = clamp(norm / uEdgeFade, 0.0, 1.0);\n"
    + "    vec2 edgeB = clamp((1.0 - norm) / uEdgeFade, 0.0, 1.0);\n"
    + "    vec2 sa = edgeA * edgeA * edgeA * (edgeA * (edgeA * 6.0 - 15.0) + 10.0);\n"
    + "    vec2 sb = edgeB * edgeB * edgeB * (edgeB * (edgeB * 6.0 - 15.0) + 10.0);\n"
    + "    fade *= sa.x * sa.y * sb.x * sb.y;\n"
    + "  }\n"
    + "  M = clamp(M, 0.0, 1.0) * fade;\n"
    + "  glow *= fade;\n"
    + "  float hot = clamp(heat, 0.0, 1.0);\n"
    + "  float tone = smoothstep(0.3, 1.0, density) * 0.85;\n"
    + "  vec3 color = mix(uColor, uAccent, max(tone, hot));\n"
    + "  vec3 lit = uLightMode > 0.5 ? color * (1.0 - 0.35 * hot) : mix(color, vec3(1.0), 0.45 * hot);\n"
    + "  if (uNoise > 0.0) {\n"
    + "    float n = hash(floor(gl_FragCoord.xy) + floor(uTime * 60.0));\n"
    + "    lit = clamp(lit + (n - 0.5) * uNoise, 0.0, 1.0);\n"
    + "  }\n"
    + "  vec3 haze = uLightMode > 0.5 ? mix(color, vec3(1.0), 0.35) : color;\n"
    + "  float alpha = M + glow * (1.0 - M);\n"
    + "  vec3 premul = lit * M + haze * glow * (1.0 - M);\n"
    + "  if (uTransparent < 0.5) {\n"
    + "    vec3 paper = vec3(uLightMode > 0.5 ? 1.0 : 0.0);\n"
    + "    fragColor = vec4(premul + paper * (1.0 - alpha), 1.0);\n"
    + "    return;\n"
    + "  }\n"
    + "  fragColor = vec4(premul, alpha);\n"
    + "}";

  var clamp = function(v, lo, hi){ return Math.min(hi, Math.max(lo, v)); };

  function compile(gl, type, source){
    var shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    gl.deleteShader(shader);
    return null;
  }

  function link(gl, fragmentSource){
    var vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    var fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
    var program = gl.createProgram();
    if (!vertex || !fragment || !program) return null;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)){ gl.deleteProgram(program); return null; }
    var uniforms = {};
    var count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < count; i++){
      var info = gl.getActiveUniform(program, i);
      if (!info) continue;
      var name = info.name.replace(/\[0\]$/, "");
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    return { program: program, uniforms: uniforms };
  }

  function parseHex(hex){
    var h = String(hex || "#ffffff").replace("#", "").trim();
    if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split("").map(function(c){ return c + c; }).join("");
    var num = parseInt(h.slice(0, 6), 16);
    if (Number.isNaN(num)) return [1, 1, 1];
    return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
  }

  function randomFloat(){
    if (window.crypto && window.crypto.getRandomValues){
      var u32 = new Uint32Array(1);
      window.crypto.getRandomValues(u32);
      return u32[0] / 0xffffffff;
    }
    return Math.random();
  }

  function invert3(m){
    var a = m[0], b = m[1], c = m[2], d = m[3], e = m[4], f = m[5], g = m[6], h = m[7], i = m[8];
    var A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
    var det = a * A + b * B + c * C || 1;
    return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det,
      B / det, (a * i - c * g) / det, -(a * f - c * d) / det,
      C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
  }

  function multiply3(x, y){
    var out = new Array(9);
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++)
      out[r * 3 + c] = x[r * 3] * y[c] + x[r * 3 + 1] * y[3 + c] + x[r * 3 + 2] * y[6 + c];
    return out;
  }

  function planeFor(tiltX, tiltY, width, height){
    var ax = (tiltX * Math.PI) / 180, ay = (tiltY * Math.PI) / 180;
    var depth = Math.max(width, height) * 1.25, cx = width / 2, cy = height / 2;
    var tilt = [Math.cos(ay), 0, 0, Math.sin(ax) * Math.sin(ay), Math.cos(ax), 0,
      (Math.sin(ay) * Math.cos(ax)) / depth, -Math.sin(ax) / depth, 1];
    var forward = multiply3(multiply3([1, 0, cx, 0, 1, cy, 0, 0, 1], tilt), [1, 0, -cx, 0, 1, -cy, 0, 0, 1]);
    return invert3(forward);
  }

  function settingsFrom(o){
    o = o || {};
    var pick = function(k, d){ return o[k] === undefined ? d : o[k]; };
    var color = pick("color", "#B497CF");
    return {
      variant: SHAPES[pick("variant", "square")] !== undefined ? SHAPES[pick("variant", "square")] : 0,
      pixelSize: Math.max(0.5, pick("pixelSize", 3)),
      color: color,
      accentColor: o.accentColor || color,
      patternScale: pick("patternScale", 2),
      patternDensity: pick("patternDensity", 1),
      pixelSizeJitter: pick("pixelSizeJitter", 0),
      enableRipples: pick("enableRipples", true),
      rippleIntensityScale: pick("rippleIntensityScale", 1),
      rippleThickness: Math.max(0.001, pick("rippleThickness", 0.1)),
      rippleSpeed: pick("rippleSpeed", 0.3),
      autoPauseOffscreen: pick("autoPauseOffscreen", true),
      speed: pick("speed", 0.5),
      transparent: pick("transparent", true),
      edgeFade: clamp(pick("edgeFade", 0.5), 0, 1),
      noiseAmount: pick("noiseAmount", 0),
      softness: clamp(pick("softness", 0.6), 0, 1),
      smoothing: clamp(pick("smoothing", 1), 0, 1),
      glow: clamp(pick("glow", 0.4), 0, 2),
      twinkle: clamp(pick("twinkle", 0.25), 0, 1),
      drift: pick("drift", 0.2),
      driftAngle: pick("driftAngle", 30),
      hoverEffect: HOVERS[pick("hoverEffect", "reveal")] !== undefined ? HOVERS[pick("hoverEffect", "reveal")] : 0,
      hoverRadius: Math.max(10, pick("hoverRadius", 140)),
      autoRipple: Math.max(0, pick("autoRipple", 0)),
      tiltX: clamp(pick("tiltX", 0), -70, 70),
      tiltY: clamp(pick("tiltY", 0), -70, 70),
      intro: pick("intro", true),
      variation: o.variation,
      lightMode: pick("lightMode", false),
      dpr: o.dpr
    };
  }

  /** Starts the effect in `container`; returns a function that stops it and cleans up. */
  function createPixelBlast(container, options){
    var noop = function(){};
    if (!container) return noop;
    var s = settingsFrom(options);
    var canvas = document.createElement("canvas");
    canvas.className = "pixel-blast-canvas";
    canvas.setAttribute("aria-hidden", "true");
    container.classList.add("pixel-blast-container");
    container.appendChild(canvas);
    var gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    if (!gl){ canvas.remove(); return noop; }
    var cellShader = link(gl, CELL_FRAGMENT);
    var mainShader = link(gl, MAIN_FRAGMENT);
    if (!cellShader || !mainShader){ canvas.remove(); return noop; }
    var cu = cellShader.uniforms, mu = mainShader.uniforms;
    var vao = gl.createVertexArray();

    function makeTexture(filter){
      var texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      return texture;
    }
    var targets = [0, 1].map(function(){
      var texture = makeTexture(gl.LINEAR);
      var framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      return { texture: texture, framebuffer: framebuffer };
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;
    var view = { width: 1, height: 1, ratio: 1, plane: null, tiltKey: "" };
    var cells = { x: 0, y: 0, w: 1, h: 1, key: "" };
    var pointer = { x: 0, y: 0, inside: false };
    var mouse = { x: 0, y: 0, ready: false };
    var clickPos = new Float32Array(MAX_CLICKS * 2).fill(-1);
    var clickAt = new Float32Array(MAX_CLICKS);
    var clickAge = new Float32Array(MAX_CLICKS);
    var planeClicks = new Float32Array(MAX_CLICKS * 2);
    var clickIndex = 0, current = 0, fresh = true;
    var timeOffset = typeof s.variation === "number" ? s.variation * 37 : randomFloat() * 1000;
    var elapsed = 0, clock = 0, presence = 0, driftX = 0, driftY = 0;
    var introClock = s.intro && !reduce ? 0 : 1;
    var nextAuto = 1.2, raf = 0, last = 0, visible = true, quiet = 0, stopped = false;

    var patternTime = function(){ return timeOffset + elapsed * s.speed; };

    function toPlane(x, y){
      var m = view.plane;
      if (!m) return [x, y];
      var h = canvas.height, cy = h - y;
      var z = m[6] * x + m[7] * cy + m[8];
      if (z <= 1e-4) return [-1e6, -1e6];
      return [(m[0] * x + m[1] * cy + m[2]) / z, h - (m[3] * x + m[4] * cy + m[5]) / z];
    }

    function layoutCells(){
      var ps = s.pixelSize * view.ratio, cps = 8 * ps, w = canvas.width, h = canvas.height;
      var minX = -w / 2, maxX = w / 2, minY = -h / 2, maxY = h / 2;
      if (view.plane){
        var corners = [[0, 0], [w, 0], [0, h], [w, h], [w / 2, 0], [w / 2, h], [0, h / 2], [w, h / 2]];
        minX = Infinity; maxX = -Infinity; minY = Infinity; maxY = -Infinity;
        corners.forEach(function(c){
          var q = toPlane(c[0], c[1]);
          if (q[0] < -1e5) return;
          minX = Math.min(minX, q[0] - w / 2); maxX = Math.max(maxX, q[0] - w / 2);
          minY = Math.min(minY, q[1] - h / 2); maxY = Math.max(maxY, q[1] - h / 2);
        });
        if (!Number.isFinite(minX)){ minX = -w / 2; maxX = w / 2; minY = -h / 2; maxY = h / 2; }
      }
      var pad = cps;
      var x0 = Math.floor((minX - pad) / cps), x1 = Math.floor((maxX + pad) / cps);
      var y0 = Math.floor((minY - pad) / cps), y1 = Math.floor((maxY + pad) / cps);
      var width = Math.max(1, Math.min(2048, x1 - x0 + 1)), height = Math.max(1, Math.min(2048, y1 - y0 + 1));
      var key = x0 + ":" + y0 + ":" + width + ":" + height;
      if (key === cells.key) return;
      cells.key = key; cells.x = x0; cells.y = y0; cells.w = width; cells.h = height;
      targets.forEach(function(t){
        gl.bindTexture(gl.TEXTURE_2D, t.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      });
      fresh = true;
    }

    function stepCells(decay){
      for (var k = 0; k < MAX_CLICKS; k++){
        if (clickPos[k * 2] < 0){ planeClicks[k * 2] = -1; planeClicks[k * 2 + 1] = -1; continue; }
        var p = toPlane(clickPos[k * 2], clickPos[k * 2 + 1]);
        planeClicks[k * 2] = Math.max(p[0], 0); planeClicks[k * 2 + 1] = p[1];
      }
      var mp = toPlane(mouse.x, mouse.y);
      var source = targets[current], target = targets[1 - current];
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.viewport(0, 0, cells.w, cells.h);
      gl.disable(gl.BLEND);
      gl.useProgram(cellShader.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, source.texture);
      gl.uniform1i(cu.uPrev, 0);
      gl.uniform2f(cu.uResolution, canvas.width, canvas.height);
      gl.uniform1f(cu.uTime, patternTime());
      gl.uniform1f(cu.uPixelSize, s.pixelSize * view.ratio);
      gl.uniform1f(cu.uScale, s.patternScale);
      gl.uniform1f(cu.uDensity, s.patternDensity);
      gl.uniform1i(cu.uEnableRipples, s.enableRipples ? 1 : 0);
      gl.uniform1f(cu.uRippleSpeed, s.rippleSpeed);
      gl.uniform1f(cu.uRippleThickness, s.rippleThickness);
      gl.uniform1f(cu.uRippleIntensity, s.rippleIntensityScale);
      gl.uniform2fv(cu.uClickPos, planeClicks);
      gl.uniform1fv(cu.uClickAge, clickAge);
      gl.uniform2i(cu.uOrigin, cells.x, cells.y);
      gl.uniform2f(cu.uDrift, driftX, driftY);
      gl.uniform1i(cu.uHover, s.hoverEffect);
      gl.uniform2f(cu.uMouse, mp[0], mp[1]);
      gl.uniform1f(cu.uMouseRadius, s.hoverRadius * view.ratio);
      gl.uniform1f(cu.uMousePresence, presence);
      gl.uniform1f(cu.uIntro, introClock);
      gl.uniform1f(cu.uDecay, decay);
      gl.uniform1f(cu.uFresh, fresh ? 1 : 0);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      current = 1 - current;
      fresh = false;
    }

    function draw(){
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(mainShader.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, targets[current].texture);
      gl.uniform1i(mu.uCells, 0);
      gl.uniform3fv(mu.uColor, parseHex(s.color));
      gl.uniform3fv(mu.uAccent, parseHex(s.accentColor));
      gl.uniform2f(mu.uResolution, canvas.width, canvas.height);
      gl.uniform1f(mu.uTime, patternTime());
      gl.uniform1f(mu.uClock, clock);
      gl.uniform1f(mu.uPixelSize, s.pixelSize * view.ratio);
      gl.uniform1f(mu.uPixelJitter, s.pixelSizeJitter);
      gl.uniform1f(mu.uEdgeFade, s.edgeFade);
      gl.uniform1i(mu.uShapeType, s.variant);
      gl.uniform2i(mu.uOrigin, cells.x, cells.y);
      gl.uniform2i(mu.uCellCount, cells.w, cells.h);
      gl.uniform1f(mu.uSoftness, s.softness);
      gl.uniform1f(mu.uSmoothing, s.smoothing);
      gl.uniform1f(mu.uGlow, s.glow);
      gl.uniform1f(mu.uTwinkle, reduce ? 0 : s.twinkle);
      gl.uniform1f(mu.uLightMode, s.lightMode ? 1 : 0);
      gl.uniform1f(mu.uTransparent, s.transparent ? 1 : 0);
      gl.uniform1f(mu.uNoise, s.noiseAmount);
      gl.uniform1i(mu.uHover, s.hoverEffect);
      gl.uniform1f(mu.uTilted, view.plane ? 1 : 0);
      if (view.plane){
        var m = view.plane;
        gl.uniformMatrix3fv(mu.uPlane, false, [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]);
      }
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    }

    function updatePlane(){
      view.plane = s.tiltX || s.tiltY ? planeFor(s.tiltX, s.tiltY, canvas.width, canvas.height) : null;
      view.tiltKey = s.tiltX + ":" + s.tiltY + ":" + canvas.width + ":" + canvas.height;
    }

    function resize(){
      if (stopped) return;
      view.width = Math.max(1, container.clientWidth);
      view.height = Math.max(1, container.clientHeight);
      view.ratio = Math.min(s.dpr || window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(view.width * view.ratio));
      canvas.height = Math.max(1, Math.round(view.height * view.ratio));
      if (!mouse.ready){ mouse.ready = true; mouse.x = canvas.width / 2; mouse.y = canvas.height / 2; }
      updatePlane();
      layoutCells();
      stepCells(0);
      draw();
      wake();
    }

    function addRipple(x, y){
      clickPos[clickIndex * 2] = x * view.ratio;
      clickPos[clickIndex * 2 + 1] = (view.height - y) * view.ratio;
      clickAt[clickIndex] = clock;
      clickIndex = (clickIndex + 1) % MAX_CLICKS;
      wake();
    }

    function frame(now){
      raf = 0;
      if (stopped) return;
      if (!visible && s.autoPauseOffscreen) return;
      if (document.hidden) return;
      var dt = last ? clamp((now - last) / 1000, 0, 1 / 20) : 0;
      last = now;
      if (!reduce) elapsed += dt;
      clock += dt;
      if (!reduce && s.drift){
        var angle = (s.driftAngle * Math.PI) / 180;
        driftX += Math.cos(angle) * s.drift * dt * 0.05;
        driftY += Math.sin(angle) * s.drift * dt * 0.05;
      }
      if (!reduce && s.enableRipples && s.autoRipple > 0 && introClock >= 1){
        nextAuto -= dt;
        if (nextAuto <= 0){
          nextAuto = s.autoRipple * (0.7 + Math.random() * 0.6);
          addRipple((0.15 + Math.random() * 0.7) * view.width, (0.15 + Math.random() * 0.7) * view.height);
        }
      }
      for (var k = 0; k < MAX_CLICKS; k++) clickAge[k] = (clock - clickAt[k]) * 0.5;
      var targetX = pointer.x * view.ratio, targetY = (view.height - pointer.y) * view.ratio;
      var follow = 1 - Math.exp(-dt / 0.08);
      if (pointer.inside){ mouse.x += (targetX - mouse.x) * follow; mouse.y += (targetY - mouse.y) * follow; }
      presence += ((pointer.inside ? 1 : 0) - presence) * (1 - Math.exp(-dt / 0.25));
      var key = s.tiltX + ":" + s.tiltY + ":" + canvas.width + ":" + canvas.height;
      if (key !== view.tiltKey) updatePlane();
      layoutCells();
      stepCells(s.hoverEffect ? Math.exp(-dt / 0.45) : 0);
      draw();
      if (introClock < 1) introClock = Math.min(1, introClock + dt / INTRO_SECONDS);
      var busy = !reduce && (s.speed !== 0 || s.drift !== 0 || s.twinkle > 0 || (s.autoRipple > 0 && s.enableRipples));
      busy = busy || introClock < 1 || presence > 0.001;
      for (var j = 0; j < MAX_CLICKS; j++) busy = busy || (clickPos[j * 2] >= 0 && clickAge[j] < 8);
      quiet = busy ? 0 : quiet + dt;
      if (quiet < 1.5) raf = requestAnimationFrame(frame);
    }

    function wake(){
      quiet = 0;
      if (!stopped && !raf && (visible || !s.autoPauseOffscreen) && !document.hidden){
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    }

    function locate(event){
      var rect = container.getBoundingClientRect();
      var x = event.clientX - rect.left, y = event.clientY - rect.top;
      return { x: x, y: y, inside: x >= 0 && y >= 0 && x <= rect.width && y <= rect.height };
    }
    function onPointerMove(event){
      var l = locate(event), was = pointer.inside;
      pointer.inside = l.inside;
      if (l.inside){
        pointer.x = l.x; pointer.y = l.y;
        if (!was){ mouse.x = l.x * view.ratio; mouse.y = (view.height - l.y) * view.ratio; }
      }
      if (l.inside || was) wake();
    }
    function onPointerDown(event){
      var l = locate(event);
      if (!l.inside || reduce || !s.enableRipples) return;
      addRipple(l.x, l.y);
    }
    function onPointerLeave(){ pointer.inside = false; wake(); }
    function onVisibility(){ wake(); }

    var resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    var intersection = new IntersectionObserver(function(entries){
      visible = entries.some(function(e){ return e.isIntersecting; });
      if (visible) wake();
    });
    intersection.observe(container);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);
    resize();

    return function stop(){
      stopped = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersection.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      targets.forEach(function(t){ gl.deleteTexture(t.texture); gl.deleteFramebuffer(t.framebuffer); });
      gl.deleteVertexArray(vao);
      gl.deleteProgram(cellShader.program);
      gl.deleteProgram(mainShader.program);
      var lose = gl.getExtension("WEBGL_lose_context");
      if (lose) lose.loseContext();
      canvas.remove();
    };
  }

  window.createPixelBlast = createPixelBlast;
})();
