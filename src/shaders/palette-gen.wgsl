// Builds a 16x16x16 RGB histogram (4096 buckets).
// Dispatch with workgroup_size(8,8) over the full image.

@group(0) @binding(0) var src_texture: texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> histogram: array<atomic<u32>>;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let dims = textureDimensions(src_texture);
  if (id.x >= dims.x || id.y >= dims.y) { return; }

  let color = textureLoad(src_texture, vec2<i32>(id.xy), 0);

  // Quantize to 4 bits per channel (16 levels each)
  let r = u32(color.r * 15.0);
  let g = u32(color.g * 15.0);
  let b = u32(color.b * 15.0);

  let bucket = r * 256u + g * 16u + b;
  atomicAdd(&histogram[bucket], 1u);
}
