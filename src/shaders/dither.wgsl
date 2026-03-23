// Bayer 8x8 ordered dithering with nearest-palette-color quantization.
// Outputs a flat array of palette indices (one u32 per pixel).

struct DitherParams {
  width: u32,
  height: u32,
  palette_size: u32,
  dither_strength: f32, // 0.0 = no dither, 1.0 = full Bayer
}

@group(0) @binding(0) var src_texture: texture_2d<f32>;
@group(0) @binding(1) var<storage, read> palette: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> indices: array<u32>;
@group(0) @binding(3) var<uniform> params: DitherParams;

// Bayer 8x8 matrix values (0–63), normalized to [-0.5, 0.5]
fn bayer8(x: u32, y: u32) -> f32 {
  let bayer = array<u32, 64>(
     0u, 32u,  8u, 40u,  2u, 34u, 10u, 42u,
    48u, 16u, 56u, 24u, 50u, 18u, 58u, 26u,
    12u, 44u,  4u, 36u, 14u, 46u,  6u, 38u,
    60u, 28u, 52u, 20u, 62u, 30u, 54u, 22u,
     3u, 35u, 11u, 43u,  1u, 33u,  9u, 41u,
    51u, 19u, 59u, 27u, 49u, 17u, 57u, 25u,
    15u, 47u,  7u, 39u, 13u, 45u,  5u, 37u,
    63u, 31u, 55u, 23u, 61u, 29u, 53u, 21u,
  );
  return (f32(bayer[(y % 8u) * 8u + (x % 8u)]) / 64.0) - 0.5;
}

fn nearest_palette(color: vec3<f32>) -> u32 {
  var best_idx: u32 = 0u;
  var best_dist: f32 = 1e9;
  for (var i: u32 = 0u; i < params.palette_size; i++) {
    let diff = color - palette[i].rgb;
    let dist = dot(diff, diff);
    if (dist < best_dist) {
      best_dist = dist;
      best_idx = i;
    }
  }
  return best_idx;
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= params.width || id.y >= params.height) { return; }

  var color = textureLoad(src_texture, vec2<i32>(id.xy), 0).rgb;

  // Apply Bayer threshold offset
  let threshold = bayer8(id.x, id.y) * params.dither_strength * (1.0 / 16.0);
  color = clamp(color + vec3<f32>(threshold), vec3<f32>(0.0), vec3<f32>(1.0));

  let idx = nearest_palette(color);
  indices[id.y * params.width + id.x] = idx;
}
