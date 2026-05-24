module.exports = {
  packagerConfig: { name: 'Pearschool Mini', icon: './build/icon' },
  makers: [
    { name: '@electron-forge/maker-squirrel', config: { name: 'PearschoolMini' } },
    { name: '@electron-forge/maker-dmg', config: { format: 'ULFO' } },
    { name: '@electron-forge/maker-deb', config: {} }
  ]
}
