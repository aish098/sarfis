export const pbiFadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
};

export const pbiStagger = { animate: { transition: { staggerChildren: 0.06 } } };
