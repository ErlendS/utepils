export class LruMap<K, V> {
  #max: number
  #map = new Map<K, V>()

  constructor(max: number) {
    this.#max = max
  }

  get(key: K): V | undefined {
    let val = this.#map.get(key)
    if (val !== undefined) {
      this.#map.delete(key)
      this.#map.set(key, val)
    }
    return val
  }

  set(key: K, val: V): this {
    if (this.#map.has(key)) this.#map.delete(key)
    else if (this.#map.size >= this.#max) this.#map.delete(this.#map.keys().next().value!)
    this.#map.set(key, val)
    return this
  }

  delete(key: K): boolean {
    return this.#map.delete(key)
  }
}
