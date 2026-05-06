import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'

const MODES = {
  work:       { label: '专注工作', color: '#f38ba8' },
  shortBreak: { label: '短暂休息', color: '#a6e3a1' },
  longBreak:  { label: '长时休息', color: '#89b4fa' },
}

const DEFAULT_MINUTES = { work: 25, shortBreak: 5, longBreak: 15 }
const POMODOROS_BEFORE_LONG = 4
const RADIUS = 90
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function pad(n) { return String(n).padStart(2, '0') }

function loadMinutes() {
  try {
    const saved = localStorage.getItem('pomodoroMinutes')
    if (saved) return { ...DEFAULT_MINUTES, ...JSON.parse(saved) }
  } catch {}
  return { ...DEFAULT_MINUTES }
}

function clampMinutes(v) { return Math.min(99, Math.max(1, parseInt(v) || 1)) }

export default function App() {
  const [mode, setMode]               = useState('work')
  const [customMinutes, setCustomMinutes] = useState(loadMinutes)
  const [remaining, setRemaining]     = useState(() => loadMinutes().work * 60)
  const [running, setRunning]         = useState(false)
  const [pomodoroCount, setPomodoroCount] = useState(0)
  const [showSettings, setShowSettings]   = useState(false)
  const [draft, setDraft]             = useState(DEFAULT_MINUTES)
  const intervalRef    = useRef(null)
  const audioCtxRef    = useRef(null)
  const customMinRef   = useRef(customMinutes)

  useEffect(() => { customMinRef.current = customMinutes }, [customMinutes])

  const { color, label } = MODES[mode]
  const minutes    = customMinutes[mode]
  const total      = minutes * 60
  const fraction   = remaining / total
  const dashOffset = CIRCUMFERENCE * (1 - fraction)
  const mins       = Math.floor(remaining / 60)
  const secs       = remaining % 60

  const ensureAudioCtx = useCallback(() => {
    if (!audioCtxRef.current)
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    if (audioCtxRef.current.state === 'suspended')
      audioCtxRef.current.resume()
  }, [])

  const playSound = useCallback(() => {
    try {
      ensureAudioCtx()
      const ctx = audioCtxRef.current
      ;[523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc  = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = freq
        osc.type = 'sine'
        const t = ctx.currentTime + i * 0.18
        gain.gain.setValueAtTime(0, t)
        gain.gain.linearRampToValueAtTime(0.28, t + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
        osc.start(t)
        osc.stop(t + 0.35)
      })
    } catch (_) {}
  }, [ensureAudioCtx])

  const notify = useCallback((title, body) => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted')
      new Notification(title, { body, icon: '🍅' })
  }, [])

  const handleComplete = useCallback(() => {
    setRunning(false)
    playSound()
    const mins = customMinRef.current
    if (mode === 'work') {
      setPomodoroCount(prev => {
        const next     = prev + 1
        const nextMode = next % POMODOROS_BEFORE_LONG === 0 ? 'longBreak' : 'shortBreak'
        notify('专注结束！', `第 ${next} 个番茄完成 🍅`)
        setMode(nextMode)
        setRemaining(mins[nextMode] * 60)
        return next
      })
    } else {
      notify('休息结束！', '准备好了吗？开始下一个番茄钟 💪')
      setMode('work')
      setRemaining(mins.work * 60)
    }
  }, [mode, playSound, notify])

  useEffect(() => {
    if (!running) { clearInterval(intervalRef.current); return }
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) { clearInterval(intervalRef.current); handleComplete(); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [running, handleComplete])

  useEffect(() => {
    document.title = `${pad(mins)}:${pad(secs)} — ${label}`
  }, [mins, secs, label])

  const handleToggle = () => {
    if (!running && typeof Notification !== 'undefined' && Notification.permission === 'default')
      Notification.requestPermission()
    ensureAudioCtx()
    setRunning(r => !r)
  }

  const handleReset = () => { setRunning(false); setRemaining(total) }

  const handleModeChange = m => {
    setRunning(false); setMode(m); setRemaining(customMinutes[m] * 60)
  }

  const handleOpenSettings = () => {
    setDraft({ ...customMinutes })
    setShowSettings(s => !s)
  }

  const handleApplySettings = () => {
    const next = {
      work:       clampMinutes(draft.work),
      shortBreak: clampMinutes(draft.shortBreak),
      longBreak:  clampMinutes(draft.longBreak),
    }
    setCustomMinutes(next)
    localStorage.setItem('pomodoroMinutes', JSON.stringify(next))
    if (!running) setRemaining(next[mode] * 60)
    setShowSettings(false)
  }

  const cyclePos = pomodoroCount % POMODOROS_BEFORE_LONG

  return (
    <div className="app">
      <div className="app-header">
        <h1 className="app-title">🍅 番茄钟</h1>
        <button
          className={`btn-gear${showSettings ? ' active' : ''}`}
          onClick={handleOpenSettings}
          title="自定义时长"
        >⚙</button>
      </div>

      {showSettings && (
        <div className="settings-panel">
          {Object.entries(MODES).map(([key, { label, color }]) => (
            <div key={key} className="settings-row">
              <span className="settings-label" style={{ color }}>{label}</span>
              <input
                className="settings-input"
                type="number"
                min="1"
                max="99"
                value={draft[key]}
                onChange={e => setDraft(p => ({ ...p, [key]: e.target.value }))}
              />
              <span className="settings-unit">分钟</span>
            </div>
          ))}
          <button className="btn btn-apply" onClick={handleApplySettings}>确定</button>
        </div>
      )}

      <div className="mode-tabs">
        {Object.entries(MODES).map(([key, info]) => (
          <button
            key={key}
            className={`mode-tab${mode === key ? ' active' : ''}`}
            style={mode === key ? { color: info.color, borderColor: info.color } : {}}
            onClick={() => handleModeChange(key)}
          >
            {info.label}
          </button>
        ))}
      </div>

      <div className="timer-wrap">
        <svg width="240" height="240" viewBox="0 0 240 240">
          <circle cx="120" cy="120" r={RADIUS} fill="none" stroke="#2a2a3e" strokeWidth="16" />
          <circle
            cx="120" cy="120" r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth="16"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform="rotate(-90 120 120)"
            style={{ transition: running ? 'stroke-dashoffset 0.9s linear' : 'none', filter: `drop-shadow(0 0 8px ${color}88)` }}
          />
          <text x="120" y="112" textAnchor="middle" className="svg-time" fill="#e0e0f0">
            {pad(mins)}:{pad(secs)}
          </text>
          <text x="120" y="144" textAnchor="middle" className="svg-mode" fill={color}>
            {label}
          </text>
        </svg>
      </div>

      <div className="controls">
        <button
          className="btn btn-start"
          style={{ background: color, boxShadow: `0 4px 20px ${color}55` }}
          onClick={handleToggle}
        >
          {running ? '暂停' : remaining === total ? '开始' : '继续'}
        </button>
        <button className="btn btn-reset" onClick={handleReset}>重置</button>
        <button className="btn btn-reset" onClick={playSound} title="测试音效">🔔</button>
      </div>

      <div className="session-row">
        <span className="session-label">今日完成 {pomodoroCount} 个番茄</span>
        <div className="dots">
          {Array.from({ length: POMODOROS_BEFORE_LONG }).map((_, i) => (
            <span
              key={i}
              className="dot"
              style={{
                background: i < cyclePos ? color : 'transparent',
                borderColor: i < cyclePos ? color : '#3a3a50',
                boxShadow: i < cyclePos ? `0 0 6px ${color}88` : 'none',
              }}
            />
          ))}
        </div>
        {pomodoroCount > 0 && cyclePos === 0 && (
          <span className="long-break-badge" style={{ color }}>✨ 长休息时间到！</span>
        )}
      </div>
    </div>
  )
}
