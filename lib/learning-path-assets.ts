export const learningPathAssets = {
  logo: "/assets/learning-path/logo-384.webp",
  capitolPlatform: "/assets/learning-path/capitol-platform-512.png",
  capitolPath: "/assets/learning-path/capitol-path-512.png",
  starCoin: "/assets/learning-path/star-coin-512.png",
  checkCoin: "/assets/learning-path/check-coin-512.png",
  treasureChest: "/assets/learning-path/treasure-chest-512.png",
} as const;

export type LearningPathAsset = keyof typeof learningPathAssets;
