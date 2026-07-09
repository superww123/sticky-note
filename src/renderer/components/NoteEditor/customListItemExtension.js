import ListItem from '@tiptap/extension-list-item'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import OrderedListItemView from './OrderedListItemView.vue'

export const CustomListItem = ListItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      value: {
        default: null,
        parseHTML: el => {
          const v = el.getAttribute('value')
          return v !== null ? parseInt(v, 10) : null
        },
        renderHTML: attrs => {
          if (attrs.value == null) return {}
          return { value: String(attrs.value) }
        },
      },
    }
  },
  addNodeView() {
    return VueNodeViewRenderer(OrderedListItemView)
  },
})
