// Shared color palette. Lives here (not inline in App.jsx) so the lazy-loaded
// LocatorMap module can import it without pulling App into its chunk.
export const C = {
  bg:"#f4f1eb", surface:"#ffffff", warm:"#faf8f4",
  border:"#e2d8c8", borderStrong:"#c8b89a",
  text:"#1c1917", muted:"#6b6356", light:"#746a58", navy:"#243447",
};
