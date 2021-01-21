// Increment a min breakpoint value by one to get the max
function set_bp_max(min_val) {
  return `${parseInt(min_val, 10) + 1}px`;
}

const bp_min = {
  xs: "480px",
  sm: "600px",
  md: "900px",
  lg: "1200px",
  "lg-xl": "1450px",
  xl: "1850px",
  xxl: "2250px",
};

const bp_max = {
  xs: set_bp_max(bp_min.xs),
  sm: set_bp_max(bp_min.sm),
  md: set_bp_max(bp_min.md),
  lg: set_bp_max(bp_min.lg),
  "lg-xl": set_bp_max(bp_min["lg-xl"]),
  xl: set_bp_max(bp_min.xl),
  xxl: set_bp_max(bp_min.xxl),
};

module.exports = {
  bp_min,
  bp_max,
};
