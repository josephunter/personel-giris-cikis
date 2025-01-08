import { useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import axios from 'axios';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface EmployeeStats {
  name: string;
  averageWorkMinutes: number;
  averageBreakMinutes: number;
  totalWorkMinutes: number;
  totalBreakMinutes: number;
  daysWorked: number;
  averageFirstEntry: string;
  averageLastExit: string;
  outliers: Array<{
    date: string;
    workMinutes: number;
    breakMinutes: number;
  }>;
}

interface CompanyStats {
  averageWorkMinutesPerDay: number;
  averageBreakMinutesPerDay: number;
  totalWorkMinutes: number;
  totalBreakMinutes: number;
  averageFirstEntry: string;
  averageLastExit: string;
}

interface AnalysisResult {
  employeeStats: Record<string, EmployeeStats>;
  companyStats: CompanyStats;
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}s ${mins}dk`;
}

function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function App() {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setLoading(true);
    try {
      const response = await axios.post('/api/analyze', formData);
      setAnalysisResult(response.data);
    } catch (error) {
      console.error('Error analyzing file:', error);
      alert('Dosya analiz edilirken bir hata oluştu.');
    }
    setLoading(false);
  };

  const renderCharts = () => {
    if (!analysisResult) return null;

    const sortedEmployees = Object.entries(analysisResult.employeeStats)
      .sort(([, a], [, b]) => b.averageWorkMinutes - a.averageWorkMinutes);

    const employeeNames = sortedEmployees.map(([, stat]) => stat.name);
    const workMinutes = sortedEmployees.map(([, stat]) => stat.averageWorkMinutes);
    const breakMinutes = sortedEmployees.map(([, stat]) => stat.averageBreakMinutes);

    const chartData = {
      labels: employeeNames,
      datasets: [
        {
          label: 'Ortalama Çalışma Süresi (dk)',
          data: workMinutes,
          backgroundColor: 'rgba(53, 162, 235, 0.5)',
        },
        {
          label: 'Ortalama Mola Süresi (dk)',
          data: breakMinutes,
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
        },
      ],
    };

    return (
      <div className="mt-8">
        <Bar
          data={chartData}
          options={{
            responsive: true,
            plugins: {
              legend: {
                position: 'top' as const,
              },
              title: {
                display: true,
                text: 'Personel Çalışma ve Mola Süreleri (Çalışma Süresine Göre Sıralı)',
              },
            },
          }}
        />
      </div>
    );
  };

  const renderTop5Lists = () => {
    if (!analysisResult) return null;

    const employees = Object.entries(analysisResult.employeeStats);

    // En çok çalışanlar
    const topWorkers = [...employees]
      .sort(([, a], [, b]) => b.averageWorkMinutes - a.averageWorkMinutes)
      .slice(0, 5);

    // En çok mola verenler
    const topBreakers = [...employees]
      .sort(([, a], [, b]) => b.averageBreakMinutes - a.averageBreakMinutes)
      .slice(0, 5);

    // En erken gelenler
    const earliestArrivers = [...employees]
      .filter(([, stats]) => stats.averageFirstEntry)
      .sort(([, a], [, b]) => {
        if (!a.averageFirstEntry || !b.averageFirstEntry) return 0;
        return timeToMinutes(a.averageFirstEntry) - timeToMinutes(b.averageFirstEntry);
      })
      .slice(0, 5);

    // En geç başlayanlar
    const latestStarters = [...employees]
      .filter(([, stats]) => stats.averageFirstEntry)
      .sort(([, a], [, b]) => {
        if (!a.averageFirstEntry || !b.averageFirstEntry) return 0;
        return timeToMinutes(b.averageFirstEntry) - timeToMinutes(a.averageFirstEntry);
      })
      .slice(0, 5);

    // En geç çıkanlar
    const latestLeavers = [...employees]
      .filter(([, stats]) => stats.averageLastExit)
      .sort(([, a], [, b]) => {
        if (!a.averageLastExit || !b.averageLastExit) return 0;
        return timeToMinutes(b.averageLastExit) - timeToMinutes(a.averageLastExit);
      })
      .slice(0, 5);

    return (
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* En Çok Çalışanlar */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">En Çok Çalışan Top 5</h3>
          <div className="space-y-3">
            {topWorkers.map(([sicilNo, stats], index) => (
              <div key={sicilNo} className="flex items-center p-3 bg-blue-50 rounded-lg border border-blue-100">
                <span className="text-2xl font-bold text-blue-500 mr-4">{index + 1}</span>
                <div>
                  <p className="font-medium text-gray-900">{stats.name}</p>
                  <p className="text-sm text-gray-600">Günlük Ort: {formatMinutes(stats.averageWorkMinutes)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* En Çok Mola Verenler */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-red-900 mb-4">En Çok Mola Veren Top 5</h3>
          <div className="space-y-3">
            {topBreakers.map(([sicilNo, stats], index) => (
              <div key={sicilNo} className="flex items-center p-3 bg-red-50 rounded-lg border border-red-100">
                <span className="text-2xl font-bold text-red-500 mr-4">{index + 1}</span>
                <div>
                  <p className="font-medium text-gray-900">{stats.name}</p>
                  <p className="text-sm text-gray-600">Günlük Ort: {formatMinutes(stats.averageBreakMinutes)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* En Erken Gelenler */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-emerald-900 mb-4">En Erken Gelen Top 5</h3>
          <div className="space-y-3">
            {earliestArrivers.map(([sicilNo, stats], index) => (
              <div key={sicilNo} className="flex items-center p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                <span className="text-2xl font-bold text-emerald-500 mr-4">{index + 1}</span>
                <div>
                  <p className="font-medium text-gray-900">{stats.name}</p>
                  <p className="text-sm text-gray-600">Ort. Giriş: {stats.averageFirstEntry || 'Veri yok'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* En Geç Başlayanlar */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-orange-900 mb-4">En Geç İşe Başlayan Top 5</h3>
          <div className="space-y-3">
            {latestStarters.map(([sicilNo, stats], index) => (
              <div key={sicilNo} className="flex items-center p-3 bg-orange-50 rounded-lg border border-orange-100">
                <span className="text-2xl font-bold text-orange-500 mr-4">{index + 1}</span>
                <div>
                  <p className="font-medium text-gray-900">{stats.name}</p>
                  <p className="text-sm text-gray-600">Ort. Giriş: {stats.averageFirstEntry || 'Veri yok'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* En Geç Çıkanlar */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-purple-900 mb-4">En Geç Çıkış Yapan Top 5</h3>
          <div className="space-y-3">
            {latestLeavers.map(([sicilNo, stats], index) => (
              <div key={sicilNo} className="flex items-center p-3 bg-purple-50 rounded-lg border border-purple-100">
                <span className="text-2xl font-bold text-purple-500 mr-4">{index + 1}</span>
                <div>
                  <p className="font-medium text-gray-900">{stats.name}</p>
                  <p className="text-sm text-gray-600">Ort. Çıkış: {stats.averageLastExit || 'Veri yok'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Aritatürk Personel Takip Sistemi</h1>
          
          <div className="mb-8">
            <label
              htmlFor="file-upload"
              className="cursor-pointer bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors font-medium shadow-sm"
            >
              CSV Dosyası Yükle
              <input
                id="file-upload"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {loading && (
            <div className="text-gray-700">Dosya analiz ediliyor...</div>
          )}

          {analysisResult && (
            <div className="mt-8">
              <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Şirket Genel İstatistikleri</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-sm text-gray-700 mb-1">Günlük Ortalama Çalışma Süresi</p>
                    <p className="text-lg font-semibold text-blue-900">{formatMinutes(analysisResult.companyStats.averageWorkMinutesPerDay)}</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                    <p className="text-sm text-gray-700 mb-1">Günlük Ortalama Mola Süresi</p>
                    <p className="text-lg font-semibold text-red-900">{formatMinutes(analysisResult.companyStats.averageBreakMinutesPerDay)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                    <p className="text-sm text-gray-700 mb-1">Şirket Ortalama Giriş Saati</p>
                    <p className="text-lg font-semibold text-green-900">{analysisResult.companyStats.averageFirstEntry || 'Veri yok'}</p>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                    <p className="text-sm text-gray-700 mb-1">Şirket Ortalama Çıkış Saati</p>
                    <p className="text-lg font-semibold text-orange-900">{analysisResult.companyStats.averageLastExit || 'Veri yok'}</p>
                  </div>
                </div>
              </div>

              {renderTop5Lists()}
              {renderCharts()}

              <div className="mt-8 grid gap-6">
                {Object.entries(analysisResult.employeeStats)
                  .sort(([, a], [, b]) => b.averageWorkMinutes - a.averageWorkMinutes)
                  .map(([sicilNo, stats]) => (
                  <div key={sicilNo} className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      {stats.name} (Sicil No: {sicilNo})
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        Günlük Ort. Çalışma: {formatMinutes(stats.averageWorkMinutes)}
                      </span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-sm text-gray-600 mb-1">Ortalama Çalışma</p>
                        <p className="font-semibold text-gray-900">{formatMinutes(stats.averageWorkMinutes)}</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-sm text-gray-600 mb-1">Ortalama Mola</p>
                        <p className="font-semibold text-gray-900">{formatMinutes(stats.averageBreakMinutes)}</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-sm text-gray-600 mb-1">Çalışılan Gün</p>
                        <p className="font-semibold text-gray-900">{stats.daysWorked} gün</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-sm text-gray-600 mb-1">Ortalama İlk Giriş</p>
                        <p className="font-semibold text-green-900">{stats.averageFirstEntry || 'Veri yok'}</p>
                      </div>
                      <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <p className="text-sm text-gray-600 mb-1">Ortalama Son Çıkış</p>
                        <p className="font-semibold text-orange-900">{stats.averageLastExit || 'Veri yok'}</p>
                      </div>
                    </div>

                    {stats.outliers.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Sapma Gösteren Günler</h4>
                        <div className="space-y-2">
                          {stats.outliers.map((outlier, index) => (
                            <div key={index} className="text-sm bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                              <span className="font-medium text-gray-900">{outlier.date}:</span>{' '}
                              <span className="text-gray-700">
                                Çalışma: {formatMinutes(outlier.workMinutes)},
                                Mola: {formatMinutes(outlier.breakMinutes)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
