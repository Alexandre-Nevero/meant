// Minimal shim so the design canvas artboards (*.dc.html) render standalone in a
// browser. The real "dc" tool is proprietary; this reimplements just enough of its
// contract for a static preview: <helmet> hoists into <head>, <x-dc> is a transparent
// wrapper, the trailing <script data-dc-script> defines `class Component extends
// DCLogic { renderVals() {...} }` and its return value feeds every {{path}} and
// <sc-for list="{{path}}" as="name"> in the tree. Never edit the artboards to fit
// this file — only this file adapts to them.

window.DCLogic = class DCLogic {
  renderVals() {
    return {}
  }
}

function resolve(path, scope) {
  return path
    .trim()
    .split('.')
    .reduce((v, key) => (v == null ? v : v[key]), scope)
}

function interpolate(str, scope) {
  return str.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, path) => {
    const v = resolve(path, scope)
    return v == null ? '' : String(v)
  })
}

function substituteAttrs(el, scope) {
  for (const attr of Array.from(el.attributes)) {
    if (attr.value.includes('{{')) el.setAttribute(attr.name, interpolate(attr.value, scope))
  }
}

function substituteTree(root, scope) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
  const nodes = []
  let n
  while ((n = walker.nextNode())) nodes.push(n)
  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent.includes('{{')) node.textContent = interpolate(node.textContent, scope)
    } else {
      substituteAttrs(node, scope)
    }
  }
}

function expandScFor(scFor, scope) {
  const list = resolve(scFor.getAttribute('list').replace(/\{\{|\}\}/g, ''), scope) || []
  const as = scFor.getAttribute('as')
  const frag = document.createDocumentFragment()
  for (const item of list) {
    for (const child of Array.from(scFor.children)) {
      const clone = child.cloneNode(true)
      substituteTree(clone, { ...scope, [as]: item })
      frag.appendChild(clone)
    }
  }
  scFor.replaceWith(frag)
}

function main() {
  // <helmet> content belongs in <head> — hoist then discard the wrapper.
  document.querySelectorAll('helmet').forEach((h) => {
    while (h.firstChild) document.head.appendChild(h.firstChild)
    h.remove()
  })

  // <x-dc> is a layout-transparent wrapper around the artboard's real root div.
  const style = document.createElement('style')
  style.textContent = 'x-dc { display: contents; }'
  document.head.appendChild(style)

  const scriptTag = document.querySelector('script[data-dc-script]')
  const dcRoot = document.querySelector('x-dc')
  if (!scriptTag || !dcRoot) return

  const Component = new Function('DCLogic', `${scriptTag.textContent}\nreturn Component;`)(
    window.DCLogic,
  )
  const scope = new Component().renderVals()

  dcRoot.querySelectorAll('sc-for').forEach((scFor) => expandScFor(scFor, scope))
  substituteTree(dcRoot, scope)
}

document.addEventListener('DOMContentLoaded', main)
