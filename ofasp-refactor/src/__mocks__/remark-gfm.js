// Mock for remark-gfm plugin
const remarkGfm = () => {
  return function transformer(tree) {
    return tree;
  };
};

export default remarkGfm;