import Vue from 'vue'

const toBooleanOrOtherOrFallback = (value, fallback) => value === 'false' ? false : value === 'true' ? true : value || fallback

const parseQueryToggles = (queryObject = {}, { prefix, mode }) => {
  let entries = []
  if (mode === 'grouped') {
    entries = (queryObject[prefix] || '')
      .split(',')
      .filter(option => !!option)
      .map(entry => entry.split(/:/))
      .map(([key, value]) => [key, value])
  } else {
    entries = Object.entries(queryObject)
      .filter(([key]) => key.startsWith(`${prefix}_`))
      .map(([key, value]) => [key.replace(`${prefix}_`, ''), value])
  }
  return entries.reduce((toggles, [key, value]) => ({
    ...toggles,
    [key]: toBooleanOrOtherOrFallback(value, true)
  }), {})
}

const getPrefixedKey = (key, keyPrefix = '') => {
  return key.startsWith(keyPrefix) ? key : `${keyPrefix}${key}`
}

export default (ctx, inject) => {
  const { $config, route, app: { router } } = ctx
  const { toggles: _toggles, queryString: _queryString } = JSON.parse(`<%= JSON.stringify(options) %>`)
  const runtimeConfig = ($config && $config.featureToggle) || {}
  const queryString = typeof runtimeConfig.queryString !== 'undefined' ? runtimeConfig.queryString : _queryString
  let queryToggles = {}

  if (queryString && queryString.enabled) {
    if (router && route) {
      queryToggles = parseQueryToggles(route.query, { ...queryString })
      router.afterEach((to) => {
        featureToggle.toggles = {
          ..._toggles,
          ...(runtimeConfig.toggles || {}),
          ...parseQueryToggles(to.query, queryString)
        }
      })
    }
  }
  const toggles = {
    ..._toggles,
    ...(runtimeConfig.toggles || {}),
    ...queryToggles
  }
  Vue.component('feature-toggle', () => import('./feature-toggle.vue'))

  const featureToggle = {
    toggles,
    queryString,
    isQueryStringAllowed: (fn) => {
      featureToggle.isQueryStringAllowedFn = fn
    },
    toQueryString: ({ mode = queryString.mode } = { mode: queryString.mode }) => {
      const queryStringPrefix = mode === 'grouped' ? queryString.prefix + '=' : ''
      const separator = mode === 'grouped' ? ':' : '='
      const delimiter = mode === 'grouped' ? ',' : '&'
      return queryStringPrefix + Object.entries(featureToggle.toQueryObject({ mode }))
        .map(([key, value]) => `${encodeURIComponent(key)}${separator}${encodeURIComponent(value)}`)
        .join(delimiter)
    },
    toQueryObject: ({ mode = queryString.mode, override = {} } = { mode: queryString.mode, override: {} }) => {
      const keyPrefix = mode === 'grouped' ? '' : `${queryString.prefix}_`
      const map = Object.entries({ ...featureToggle.toggles, ...override })
        .reduce((all, [key, value]) => ({
          ...all,
          [getPrefixedKey(key, keyPrefix)]: value
        }), {})
      return mode === 'grouped' ? {
        [queryString.prefix]: Object.entries(map).map(([key, value]) => `${key}:${value}`).join(',')
      } : map
    },
    getFromQueryString: (queryObject, key) => {
      if (queryString.mode === 'grouped') {
        const queryToggles = parseQueryToggles(queryObject, queryString)
        return queryToggles[key]
      } else {
        return queryObject[getPrefixedKey(key, queryString.prefix + '_')]
      }
    }
  }

  ctx.$featureToggle = featureToggle
  inject('featureToggle', featureToggle)
}
