const visit = require('unist-util-visit');

module.exports = ({ markdownAST }) => {
  visit(markdownAST, 'code', (node, index, parent) => {
    const { lang } = node;

    if (lang !== 'html example') {
      return;
    }

    const newIndex = index + 1;

    parent.children.splice(newIndex, 0, {
      ...node,
      type: 'code',
      lang: 'html'
    });

    const example = `<div class="html-example">${node.value}</div>`;

    node.type = 'html';
    node.value = example;
    
    return newIndex;
  });

  return markdownAST;
};