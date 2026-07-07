import { useState, type ReactElement } from 'react'

type DbTestResult = {
  ok: boolean
  dbPath: string
  departmentsCount: number
}

type AppApi = {
  dbTest: () => Promise<DbTestResult>
}

declare global {
  interface Window {
    api: AppApi
  }
}

function App(): ReactElement {
  const [result, setResult] = useState<DbTestResult | null>(null)

  async function testDb(): Promise<void> {
    const data = await window.api.dbTest()
    setResult(data)
  }

  return (
    <div style={{ padding: 30, direction: 'rtl', fontFamily: 'Tahoma' }}>
      <h1>برنامج التقييمات الشهرية</h1>

      <button onClick={testDb}>اختبار قاعدة البيانات SQLite</button>

      {result && (
        <pre style={{ marginTop: 20, direction: 'ltr', textAlign: 'left' }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  )
}

export default App
