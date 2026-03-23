struct ResizeParams {
  src_size: vec2<f32>,
  dst_size: vec2<f32>,
}

@group(0) @binding(0) var src_texture: texture_2d<f32>;
@group(0) @binding(1) var dst_texture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: ResizeParams;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let dst_coord = vec2<i32>(i32(id.x), i32(id.y));
  if (id.x >= u32(params.dst_size.x) || id.y >= u32(params.dst_size.y)) { return; }

  let uv = (vec2<f32>(dst_coord) + vec2<f32>(0.5)) / params.dst_size;
  let src_pos = uv * params.src_size - vec2<f32>(0.5);

  let p = vec2<i32>(floor(src_pos));
  let f = fract(src_pos);

  let src_max = vec2<i32>(params.src_size) - vec2<i32>(1);
  let c00 = textureLoad(src_texture, clamp(p + vec2(0, 0), vec2(0), src_max), 0);
  let c10 = textureLoad(src_texture, clamp(p + vec2(1, 0), vec2(0), src_max), 0);
  let c01 = textureLoad(src_texture, clamp(p + vec2(0, 1), vec2(0), src_max), 0);
  let c11 = textureLoad(src_texture, clamp(p + vec2(1, 1), vec2(0), src_max), 0);

  let color = mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y);
  textureStore(dst_texture, dst_coord, color);
}
