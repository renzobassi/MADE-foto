
import 'immer'
import {create} from 'zustand'
import {immer} from 'zustand/middleware/immer'
import {createSelectorFunctions} from 'auto-zustand-selectors-hook'
import modes from './modes'

export default createSelectorFunctions(create(immer(() => ({
  didInit: false,
  photos: [],
  activeMode: Object.keys(modes)[0],
  customPrompt: '',
  gifInProgress: false,
  gifUrl: null,
  error: null
}))))
