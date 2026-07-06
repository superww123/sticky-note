import { Image } from '@tiptap/extension-image'
import { VueNodeViewRenderer, mergeAttributes } from '@tiptap/vue-3'
import ResizableImageView from './ResizableImageView.vue'

const ResizableImage = Image.extend({
  draggable: true,   // 让 ProseMirror 把这个节点标记为可拖拽

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: 180,
        parseHTML: el => parseInt(el.getAttribute('width') || el.style.width) || 180,
        renderHTML: attrs => ({ width: attrs.width }),
      },
    }
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)]
  },

  addNodeView() {
    return VueNodeViewRenderer(ResizableImageView)
  },
})

export default ResizableImage
