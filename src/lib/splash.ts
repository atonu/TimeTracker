// Portrait launch-screen sizes: [pixel width, pixel height, device pixel ratio].
// iOS picks the image whose media query matches the device's CSS size and pixel ratio.
export const SPLASH_SIZES: [number, number, number][] = [
  [1320, 2868, 3], // iPhone 16 Pro Max
  [1206, 2622, 3], // iPhone 16 Pro
  [1290, 2796, 3], // iPhone 14/15 Pro Max, 15/16 Plus
  [1179, 2556, 3], // iPhone 14/15 Pro, 15, 16
  [1284, 2778, 3], // iPhone 12/13 Pro Max, 14 Plus
  [1170, 2532, 3], // iPhone 12/13/14, 12/13 Pro
  [1125, 2436, 3], // iPhone X/XS/11 Pro, 12/13 mini
  [1242, 2688, 3], // iPhone XS Max, 11 Pro Max
  [828, 1792, 2], // iPhone XR, 11
  [1242, 2208, 3], // iPhone 6/7/8 Plus
  [750, 1334, 2], // iPhone 6/7/8/SE
  [640, 1136, 2], // iPhone SE 1st gen
  [1668, 2388, 2], // iPad Pro 11, Air
  [2048, 2732, 2], // iPad Pro 12.9
  [1640, 2360, 2], // iPad 10th gen
  [1620, 2160, 2], // iPad 10.2
  [1536, 2048, 2], // iPad mini, 9.7
];

export const splashStartupImages = SPLASH_SIZES.map(([w, h, r]) => ({
  url: `/pwa/splash/${w}x${h}`,
  media: `(device-width: ${w / r}px) and (device-height: ${h / r}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
}));
