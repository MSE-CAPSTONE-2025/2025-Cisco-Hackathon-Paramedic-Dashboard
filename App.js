import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Linking,
  Alert,
  Platform,
  Animated,
  ScrollView
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { getDistance } from 'geolib';
import { XMLParser } from 'fast-xml-parser';
import { WebView } from 'react-native-webview';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { API_KEY, WEBEX_API_KEY, apiKey, accessKey, WEBEX_ACCESS_TOKEN } from './config';

export default function App() {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [selectedHospitalId, setSelectedHospitalId] = useState(null);
  const [screen, setScreen] = useState('splash'); // 'splash', 'hospitals', 'navigation'
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [estimatedTime, setEstimatedTime] = useState('7분-9분');
  const [showWebex, setShowWebex] = useState(false);
  const [webexUrl, setWebexUrl] = useState('');
  const [isWebexLoading, setIsWebexLoading] = useState(false);
  const [recognizedText, setRecognizedText] = useState(''); // 인식된 텍스트
  const [jsonText, setJsonText] = useState('')
  const [autoText, setAutoText] = useState('');

  const ENCODED_API_KEY = encodeURIComponent(API_KEY);
  const BASE_URL = 'http://apis.data.go.kr/B552657/ErmctInfoInqireService';

  useEffect(() => {
    // Get user's location and fetch hospital data
    (async () => {
      try {
        // Get location permission
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('위치 접근 권한이 거부되었습니다');
          return;
        }

        // Get current location
        let location = await Location.getCurrentPositionAsync({});
        const userLoc = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        };
        setUserLocation(userLoc);
        console.log('사용자 위치:', userLoc);

        // Fetch hospital data
        await fetchHospitals(userLoc.latitude, userLoc.longitude);
      } catch (error) {
        console.error('Error:', error);
        setErrorMsg('데이터를 불러오는 중 오류가 발생했습니다');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openKakaoMap = (latitude, longitude, placeName = "병원") => {
    // 목적지 좌표와 이름 설정
    const destName = encodeURIComponent(placeName);
    
    // 카카오맵 네비게이션 URL 스키마
    // 목적지(ep), 차량 이용(by=CAR), 자동 길안내 시작(auto=true)
    const kakaoMapAppUrl = `kakaomap://route?ep=${latitude},${longitude}&ename=${destName}&by=CAR&auto=true`;
    
    // 웹 URL (폴백)
    const fallbackUrl = `https://map.kakao.com/link/to/${destName},${latitude},${longitude}`;
  
    Linking.canOpenURL(kakaoMapAppUrl)
      .then(supported => {
        if (supported) {
          return Linking.openURL(kakaoMapAppUrl);
        } else {
          console.log('카카오맵 앱 URL을 열 수 없습니다. 웹 URL로 대체합니다.');
          return Linking.openURL(fallbackUrl);
        }
      })
      .catch(err => {
        console.error('URL 열기 오류:', err);
        Linking.openURL(fallbackUrl);
      });
  };

  const NavigationScreen = () => {
    if (!selectedHospital || !userLocation) return null;

    const lat = parseFloat(selectedHospital.wgs84Lat);
    const lon = parseFloat(selectedHospital.wgs84Lon);
    const userLat = userLocation.latitude;
    const userLon = userLocation.longitude;
    const arrivalTime = new Date(new Date().getTime() + (parseFloat(selectedHospital.distance) || 0) * 2 * 60000).toTimeString().substring(0, 5);

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setScreen('hospitals')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="black" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>병원 위치</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={{ width: '100%', height: 500 }}>
          <MapView
            style={{ flex: 1 }}
            initialRegion={{
              latitude: lat,
              longitude: lon,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
          >
            {/* 병원 위치 마커 */}
            <Marker
              coordinate={{
                latitude: lat,
                longitude: lon,
              }}
              title={selectedHospital.dutyName}
              description="병원 위치"
              pinColor="red"
            />
            
            {/* 사용자 위치 마커 */}
            <Marker
              coordinate={{
                latitude: userLat,
                longitude: userLon,
              }}
              title="내 위치"
              description="현재 위치"
              pinColor="blue"
            />
            
            {/* 두 지점 사이 경로 */}
            <Polyline
              coordinates={[
                { latitude: userLat, longitude: userLon },
                { latitude: lat, longitude: lon },
              ]}
              strokeWidth={3}
              strokeColor="#5882FA"
            />
          </MapView>
        </View>

        <View style={styles.routeInfo}>
          <View style={styles.routeInfoItem}>
            <Text style={styles.routeInfoLabel}>남은 거리</Text>
            <Text style={styles.routeInfoValue}>{selectedHospital.distance} km</Text>
          </View>
          <View style={styles.routeDivider} />
          <View style={styles.routeInfoItem}>
            <Text style={styles.routeInfoLabel}>도착 예정 시각</Text>
            <Text style={styles.routeInfoValue}>{arrivalTime}</Text>
          </View>
        </View>

        <TouchableOpacity 
          onPress={() => openKakaoMap(lat, lon, selectedHospital.dutyName)} 
          style={styles.kakaoNaviButton}
        >
          <Ionicons name="navigate" size={20} color="white" />
          <Text style={styles.kakaoNaviButtonText}>길안내 시작</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  };

  const fetchHospitals = async (latitude, longitude) => {
    try {
      console.log('병원 데이터 가져오기 시작...');
      // Fetch emergency medical institutions
      const endpoint = `${BASE_URL}/getEgytListInfoInqire`;
      const bed_endpoint = `${BASE_URL}/getEmrrmRltmUsefulSckbdInfoInqire`;

      const params = {
        serviceKey: ENCODED_API_KEY,
        numOfRows: 100,
        pageNo: 1,
      };

      const queryString = Object.keys(params)
        .map(key => `${key}=${params[key]}`)
        .join('&');
      
      const response = await fetch(`${endpoint}?${queryString}`);
      const xmlText = await response.text();

      const bed_response = await fetch(`${bed_endpoint}?${queryString}`);
      const bed_xmlText = await bed_response.text();
      
      const parser = new XMLParser();
      const result = parser.parse(xmlText);
      const bed_result = parser.parse(bed_xmlText)

      const bedMap = {};
      const bedItems = Array.isArray(bed_result.response.body.items.item)
        ? bed_result.response.body.items.item
        : [bed_result.response.body.items.item];

      bedItems.forEach(b => {
        bedMap[b.hpid] = b;
      });
      
      if (result.response && result.response.body && result.response.body.items && result.response.body.items.item) {
        const hospitalItems = Array.isArray(result.response.body.items.item) 
          ? result.response.body.items.item 
          : [result.response.body.items.item];
        
        // Calculate distance and sort by distance
        const hospitalsWithDistance = hospitalItems.map((hospital, index) => {
          // Check for field names that might contain coordinates
          const possibleLatFields = ['wgs84Lat', 'latitude', 'lat', 'YPos', 'y'];
          const possibleLonFields = ['wgs84Lon', 'longitude', 'lon', 'lng', 'XPos', 'x'];
          
          let hospitalLat = null;
          let hospitalLon = null;
          
          // Try to find lat/lon in different possible field names
          for (const field of possibleLatFields) {
            if (hospital[field] && !isNaN(parseFloat(hospital[field]))) {
              hospitalLat = parseFloat(hospital[field]);
              break;
            }
          }
          
          for (const field of possibleLonFields) {
            if (hospital[field] && !isNaN(parseFloat(hospital[field]))) {
              hospitalLon = parseFloat(hospital[field]);
              break;
            }
          }
          
          let distanceKm = "N/A";
          
          // Only calculate if we have valid coordinates
          if (hospitalLat !== null && hospitalLon !== null && !isNaN(hospitalLat) && !isNaN(hospitalLon)) {
            try {
              const distanceMeters = getDistance(
                { latitude, longitude },
                { latitude: hospitalLat, longitude: hospitalLon }
              );
              distanceKm = (distanceMeters / 1000).toFixed(1);
            } catch (distErr) {
              console.error('거리 계산 오류:', distErr);
            }
          }
          // Generate a unique ID
          const uniqueId = hospital.hpid || `hospital-${index}-${Date.now()}`;

          const bedInfo = bedMap[hospital.hpid];
          const icuBeds = bedInfo && bedInfo.hvicc !== undefined ? parseInt(bedInfo.hvicc, 10) : 0;
          const isER = bedInfo && bedInfo.hv7 === 'Y';
          
          return {
            ...hospital,
            id: uniqueId,
            distance: distanceKm,
            icuBeds,
            isER
          };
        });
        
        const sortedHospitals = hospitalsWithDistance
          .filter(h => h.isER && typeof h.icuBeds === 'number' && h.icuBeds > 0)
          .sort((a, b) => {
            if (a.distance === "N/A") return 1;
            if (b.distance === "N/A") return -1;
            return parseFloat(a.distance) - parseFloat(b.distance);
          });

        console.log(`정렬된 병원 수: ${sortedHospitals.length}`);
        setHospitals(sortedHospitals);
      } else {
        console.error('API 응답 구조가 예상과 다름:', JSON.stringify(result, null, 2).substring(0, 500));
        throw new Error('API 응답 형식이 유효하지 않습니다');
      }
    } catch (error) {
      console.error('병원 데이터 불러오기 오류:', error);
      setErrorMsg('병원 데이터를 불러오는데 실패했습니다');
    }
  };

  // Determine hospital departments based on dutyEmclsName
  const getDepartments = (hospital) => {
    // 지역응급의료센터 or 권역응급의료센터 일 경우 기본 과목 포함
    // Check for partial string match as API might return different formats
    if (hospital.dutyEmclsName && 
       (hospital.dutyEmclsName.includes('지역응급의료센터') || 
        hospital.dutyEmclsName.includes('권역응급의료센터'))) {
      return '내과, 외과, 소아과';
    } else if (hospital.dutyEmclsName && 
              hospital.dutyEmclsName.includes('응급실운영신고기관')) {
      return '내과, 외과';
    } else {
      return '내과';
    }
  };

  /*
  // 화상채팅 시작 함수
  const startWebexChat = async () => {
    const meetingUrl = `webex://meet/${encodeURIComponent('expert-meeting')}?token=${encodeURIComponent(WEBEX_API_KEY)}`;
    const fallback = `https://web.webex.com/meet/${encodeURIComponent('expert-meeting')}?token=${encodeURIComponent(WEBEX_API_KEY)}`;

    const supported = await Linking.canOpenURL(meetingUrl);
    if (supported) {
      await Linking.openURL(meetingUrl);      // 앱으로 열기 시도
    } else {
      await Linking.openURL(fallback); // 웹으로 fallback
    }
  };
  */


  const WEBEX_ROOM_ID = 'cd002d00-15da-11f0-8115-950bce9a44c3'; // 텍스트를 보낼 Webex 룸 ID

  // 화상채팅 시작 및 텍스트 전송 함수
  const startWebexChat = async () => {
    try {
      // 로딩 표시 시작 (상태 변수 추가 필요)
      console.log('=== Webex 연결 시작 ===');
      setIsWebexLoading(true);
      
      // 1. 현재 인식된 텍스트가 있다면 Webex API를 통해 먼저 전송
      if (autoText) {
        console.log('전송할 텍스트.');
        try {
          console.log('텍스트를 Webex 채팅방에 전송 시도...');
          
          // Webex REST API를 사용하여 메시지 전송
          const response = await fetch('https://webexapis.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${WEBEX_ACCESS_TOKEN}`
            },
            body: JSON.stringify({
              roomId: WEBEX_ROOM_ID,
              text: autoText
            })
          });
          
          if (response.ok) {
            console.log('텍스트가 Webex 채팅방에 전송되었습니다.');
            // showToast('환자 정보가 채팅방에 전송되었습니다');
          } else {
            console.error('Webex 메시지 전송 실패:', await response.text());
            // 실패해도 화상통화는 계속 진행
          }
        } catch (apiError) {
          console.error('Webex API 호출 오류:', apiError);
          // API 오류가 발생해도 화상통화는 계속 진행
        }
      }
      
      const meetingUrl = `webex://meet/${encodeURIComponent('expert-meeting')}?token=${encodeURIComponent(WEBEX_API_KEY)}`;
      const fallback = `https://web.webex.com/meet/${encodeURIComponent('expert-meeting')}?token=${encodeURIComponent(WEBEX_API_KEY)}`;
  
      const supported = await Linking.canOpenURL(meetingUrl);
      if (supported) {
        await Linking.openURL(meetingUrl);      // 앱으로 열기 시도
      } else {
        await Linking.openURL(fallback); // 웹으로 fallback
      }
      /*
      // 2. Webex 화상통화 시작 (기존 로직)
      const meetingUrl = `webex://meet/${encodeURIComponent('expert-meeting')}?token=${encodeURIComponent(WEBEX_API_KEY)}`;
      const fallback = `https://web.webex.com/meet/${encodeURIComponent('expert-meeting')}?token=${encodeURIComponent(WEBEX_API_KEY)}`;

      const supported = await Linking.canOpenURL(meetingUrl);
      if (supported) {
        await Linking.openURL(meetingUrl);      // 앱으로 열기 시도
      } else {
        await Linking.openURL(fallback); // 웹으로 fallback
      }
      console.log('Webex 화상통화가 연결되었습니다.');
      */
    } catch (error) {
      console.error('Webex 연결 오류:', error);
      Alert.alert('연결 오류', '의료진과의 통화 연결 중 문제가 발생했습니다.');
    } finally {
      // 로딩 표시 종료
      setIsWebexLoading(false);
    }
  };



  const renderHospitalItem = ({ item, index }) => {
    // Get departments
    const departments = getDepartments(item);
    
    // Check if this hospital is selected
    const isSelected = selectedHospitalId === item.id;

    return (
      <TouchableOpacity
        style={[
          styles.hospitalItem, 
          isSelected && styles.highlightedItem
        ]}
        onPress={() => {
          setSelectedHospitalId(item.id);
          setSelectedHospital(item);
          // Show navigation screen when a hospital is selected
          setScreen('navigation');
          const minTime = Math.floor(Math.random() * 10) + 5;
          const maxTime = minTime + Math.floor(Math.random() * 3) + 1;
          setEstimatedTime(`${minTime}분-${maxTime}분`);
        }}
      >
        <View style={styles.iconContainer}>
          <Ionicons name="bed-outline" size={24} color="#666" />
        </View>
        <View style={styles.hospitalInfo}>
          <Text style={styles.hospitalName}>{item.dutyName || '이름 없음'}</Text>
          <Text style={styles.departmentText}>
            가용병상 수: {item.icuBeds}
          </Text>
        </View>
        <Text style={styles.distanceText}>{item.distance} {item.distance !== "N/A" ? "km" : ""}</Text>
      </TouchableOpacity>
    );
  };

  const SplashScreen = () => (
    <SafeAreaView style={styles.splashContainer}>
      <View style={styles.splashContent}>
        <Text style={styles.splashMessage}>
          생명을 향한 출동, 오늘도 고맙습니다.
        </Text>
        <TouchableOpacity 
          style={styles.startButton}
          onPress={() => setScreen('hospitals')}
        >
          <Text style={styles.startButtonText}>시작하기</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  const HospitalsScreen = () => (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setScreen('splash')}
        >
          {/* Fix: Wrap icon in Text component */}
          <Text>
            <Ionicons name="arrow-back" size={24} color="black" />
          </Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>인근 병원 현황판</Text>
        <TouchableOpacity style={styles.searchButton}>
          {/* Fix: Wrap icon in Text component */}
          <Text>
            <Ionicons name="search" size={24} color="black" />
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={hospitals}
        renderItem={renderHospitalItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
      />

      <TouchableOpacity style={styles.sttButton} onPress={() => setScreen('STT')}>
        <Text>
          <Ionicons name="mic-outline" size={24} color="black" />
        </Text>
        <Text style={styles.chatButtonText}>환자 상태 분석</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );

  const handleGPTAnalysis = async (inputText) => {
    try {
      const prompt = `${inputText}를 바탕으로 현재 필요한 응급처치 방법(예를 들어 손가락을 얼음물에 담그기, 혹은 상처부위를 심장보다 높게 하기 등)을 한줄로 깔끔하게 소개`;

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',  // 또는 'gpt-4' 사용 가능
          messages: [{
            role: 'user',
            content: prompt
          }],
          temperature: 0.5,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(e => ({}));
        console.error('API Error:', res.status, errorData);
        throw new Error(`GPT API 호출 실패: ${res.status} ${JSON.stringify(errorData)}`);
      }

      const data = await res.json();
      return data.choices[0].message.content.trim(); // 수정된 부분: message.content

    } catch (error) {
      console.error('GPT 분석 오류:', error);
      return 'GPT 분석 오류 발생';  // 오류 발생 시 기본 메시지 반환
    }
  };

  const handleDBAnalysis = async (inputText) => {
    try {
      const prompt = `${inputText}를 바탕으로
        -성별
        -추정 나이
        -의식 상태
        -사고 유형
        -호소 증상
        -통증 부위
        -외상 부위
        -출혈 여부
        -기저질환
        -복용 약물
        에 대한 키 값 쌍 JSON 파일을 완성해서 다른 말 하지 말고 그것만 보내줘. 없는 데이터는 Null 처리하고.`;

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',  // 또는 'gpt-4' 사용 가능
          messages: [{
            role: 'user',
            content: prompt
          }],
          temperature: 0.5,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(e => ({}));
        console.error('API Error:', res.status, errorData);
        throw new Error(`GPT API 호출 실패: ${res.status} ${JSON.stringify(errorData)}`);
      }

      const data = await res.json();
      return data.choices[0].message.content.trim(); // 수정된 부분: message.content

    } catch (error) {
      console.error('GPT 분석 오류:', error);
      return 'GPT 분석 오류 발생';  // 오류 발생 시 기본 메시지 반환
    }
  };

  const STTScreen = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [recordings, setRecordings] = useState([]);
    const [processingId, setProcessingId] = useState(null); // STT 처리 중인 파일 ID
    const recordingRef = useRef(null);
    const [recordingStatus, setRecordingStatus] = useState('idle');
  
    // 클립보드에 복사 후 알림 표시 함수
    const showToast = (message) => {
      if (Platform.OS === 'android') {
        ToastAndroid.show(message, ToastAndroid.SHORT);
      } else {
        Alert.alert('알림', message);
      }
    };
  
    // 컴포넌트 마운트 시 저장된 녹음 파일 목록 불러오기
    useEffect(() => {
      loadRecordings();
    }, []);
  
    // 저장된 녹음 파일 목록 불러오기
    const loadRecordings = async () => {
      try {
        const directory = FileSystem.documentDirectory + 'recordings/';
        
        // 디렉토리 존재 확인
        const dirInfo = await FileSystem.getInfoAsync(directory);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
          setRecordings([]);
          return;
        }
        
        // 폴더 내 파일 목록 가져오기
        const files = await FileSystem.readDirectoryAsync(directory);
        
        // 각 파일의 상세 정보 가져오기
        const fileDetails = await Promise.all(
          files.map(async (fileName) => {
            const filePath = directory + fileName;
            const fileInfo = await FileSystem.getInfoAsync(filePath);
            
            // 타임스탬프에서 날짜 구하기
            const date = new Date(fileName.split('_')[1].split('.')[0] * 1);
            const formattedDate = date.toLocaleString('ko-KR');
            
            return {
              id: fileName,
              uri: filePath,
              name: fileName,
              size: fileInfo.size,
              createdAt: formattedDate,
              dateValue: date
            };
          })
        );
        
        // 날짜 기준 내림차순 정렬 (최신 파일이 맨 위)
        fileDetails.sort((a, b) => b.dateValue - a.dateValue);
        
        setRecordings(fileDetails);
      } catch (error) {
        console.error('녹음 파일 목록 로드 오류:', error);
      }
    };
  
    const startRecording = async () => {
      try {
        if (recordingStatus === 'recording') return;
        setRecordingStatus('preparing');
  
        // 오디오 권한 요청
        console.log('Requesting permissions...');
        const { granted } = await Audio.requestPermissionsAsync();
        
        if (!granted) {
          console.log('Permission to record was denied');
          setRecordingStatus('idle');
          return;
        }
        
        // 오디오 모드 설정
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });

        const recordingOptions = {
          android: {
            extension: '.m4a',
            outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
            audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 128000,
          },
          ios: {
            extension: '.caf',
            audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_MAX,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 128000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
        };        
        
        console.log('Starting recording...');
        const { recording } = await Audio.Recording.createAsync(
          recordingOptions
        );
        
        recordingRef.current = recording;
        setIsRecording(true);
        setRecordingStatus('recording');
        setRecognizedText('');
        console.log('Recording started');
      } catch (err) {
        console.error('녹음 시작 오류:', err);
        setRecordingStatus('idle');
      }
    };
  
    const stopRecording = async () => {
      console.log('Stopping recording...');
      if (recordingStatus !== 'recording' || !recordingRef.current) {
        setIsRecording(false);
        setRecordingStatus('idle');
        return;
      }
  
      try {
        setRecordingStatus('stopping');
        
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        
        if (!uri) {
          console.log('No recording URI available');
          setRecordingStatus('idle');
          setIsRecording(false);
          return;
        }
        
        // 파일 저장
        const fileName = `recording_${new Date().getTime()}.m4a`;
        const directory = FileSystem.documentDirectory + 'recordings/';
        const filePath = directory + fileName;
        
        // 디렉토리 확인 및 생성
        const dirInfo = await FileSystem.getInfoAsync(directory);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
        }
        
        // 녹음 파일 복사
        await FileSystem.copyAsync({
          from: uri,
          to: filePath
        });
        
        console.log('✅ 오디오 파일 저장 완료:', filePath);
        
        // 녹음 객체 초기화
        recordingRef.current = null;
        setIsRecording(false);
        setRecordingStatus('idle');
        
        // 녹음 목록 다시 로드
        await loadRecordings();
      } catch (err) {
        console.error('녹음 중지 오류:', err);
        recordingRef.current = null;
        setIsRecording(false);
        setRecordingStatus('idle');
      }
    };
  
    const handleMicPress = async () => {
      if (recordingStatus === 'preparing' || recordingStatus === 'stopping') {
        return;
      }
      
      if (isRecording) {
        await stopRecording();
      } else {
        await startRecording();
      }
    };
  
    // 파일을 Base64로 변환
    const fileToBase64 = async (uri) => {
      try {
        const fileContent = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return fileContent;
      } catch (error) {
        console.error('Base64 변환 오류:', error);
        throw error;
      }
    };
  
  
    // 음성인식 API 호출 - 여기를 ETRI 대신 제시하신 방식으로 변경
    const processSTT = async (item) => {
      try {
        setProcessingId(item.id);
        setRecognizedText('');
        
        console.log('STT 버튼 눌림');
        console.log('STT 처리 시작:', item.name);
        
        // 파일을 Base64로 변환
        // const audioBase64 = await fileToBase64(item.uri);
        const audioBase64 = await FileSystem.readAsStringAsync(item.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // API 설정
        const openApiURL = 'http://aiopen.etri.re.kr:8000/WiseASR/Recognition';
        const languageCode = 'korean';
        
        // API 요청 준비
        const requestJson = {
          'argument': {
            'language_code': languageCode,
            'audio': audioBase64
          }
        };
        
        // AbortController로 타임아웃 설정
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60초 타임아웃
        
        // API 호출
        const response = await fetch(openApiURL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': accessKey
          },
          body: JSON.stringify(requestJson),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // 응답 처리
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API 오류 (${response.status}): ${errorText}`);
        }
        
        const responseData = await response.json();
        console.log('STT 응답:', responseData);
        console.log('STT 응답:', response.status);
        console.log('응답 JSON 전체:', JSON.stringify(responseData, null, 2));
        
        if (responseData.result === 0) {
          // 인식된 텍스트 추출
          const text = responseData.return_object.recognized;
          // setRecognizedText(text);
          
          // GPT 분석 요청
          const gptAnalysisResult = await handleGPTAnalysis(text);
          // JSON 형식 반환
          const dbAnalysisResult = await handleDBAnalysis(text);
          
          // 원본 텍스트와 GPT 분석 결과를 결합하여 클립보드에 복사
          const textToCopy = `${text}\n\n\n환자 분석: \n${gptAnalysisResult}`;
          setAutoText(textToCopy);
          setRecognizedText(textToCopy);
          setJsonText(dbAnalysisResult);
          
          // 클립보드에 복사
          // await Clipboard.setStringAsync(text);
          // showToast('텍스트가 클립보드에 복사되었습니다');
          
          // DB 저장 로직
          try {
            console.log("DB 저장 시도 중...");
            
            // 저장할 데이터 객체 생성
            const patientData = {
              id: `patient_${Date.now()}`,
              recordingTime: new Date().toISOString(),
              originalText: text,
              analysis: gptAnalysisResult,
              status: "대기중",
              hospitalId: selectedHospitalId || null
            };
            
            await new Promise(resolve => setTimeout(resolve, 800));
            
            console.log("환자 데이터 저장 성공:", patientData);
            
            // 클립보드에 복사 전에 저장 성공 알림
            showToast('환자 정보가 응급 DB에 저장되었습니다');
            
            // 클립보드에 복사
            await Clipboard.setStringAsync(textToCopy);
            showToast('텍스트와 분석 결과가 클립보드에 복사되었습니다');
          } catch (dbError) {
            console.error("DB 저장 오류:", dbError);
            Alert.alert("저장 실패", "환자 정보를 DB에 저장하는데 실패했습니다.");
            
            // 실패해도 클립보드에는 복사
            await Clipboard.setStringAsync(textToCopy);
            showToast('텍스트와 분석 결과가 클립보드에 복사되었습니다');
          }
        } else {
          throw new Error(`인식 실패: ${responseData.result}`);
        }
      } catch (error) {
        console.error('STT 처리 오류:', error);
        
        // 더 명확한 오류 메시지 제공
        let errorMessage = '음성인식 처리 중 오류가 발생했습니다';
        
        if (error.name === 'AbortError') {
          errorMessage = '요청 시간이 초과되었습니다. 네트워크 상태를 확인하거나 나중에 다시 시도해주세요.';
        } else if (error.message.includes('504')) {
          errorMessage = '서버 응답 시간이 초과되었습니다. 더 짧은 오디오를 사용하거나 나중에 다시 시도해주세요.';
        }
        
        Alert.alert('오류', errorMessage);
      } finally {
        setProcessingId(null);
      }
    };

    // 녹음 파일 삭제
    const deleteRecording = async (id) => {
      try {
        // 현재 처리 중인 파일이면 진행하지 않음
        if (processingId === id) {
          Alert.alert('알림', '현재 처리 중인 파일은 삭제할 수 없습니다.');
          return;
        }
        
        const directory = FileSystem.documentDirectory + 'recordings/';
        const filePath = directory + id;
        
        // 파일 삭제
        await FileSystem.deleteAsync(filePath);
        console.log(`파일 삭제됨: ${id}`);
        
        // 목록에서 삭제된 파일 제거
        setRecordings(prevRecordings => 
          prevRecordings.filter(recording => recording.id !== id)
        );
        
        // 삭제된 파일의 인식 텍스트가 화면에 표시 중이었다면 초기화
        setRecognizedText('');
      } catch (error) {
        console.error('파일 삭제 오류:', error);
        Alert.alert('오류', '파일을 삭제하는 중 오류가 발생했습니다.');
      }
    };

    // 삭제 확인 대화상자
    const confirmDelete = (id) => {
      Alert.alert(
        '녹음 삭제',
        '이 녹음 파일을 삭제하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { text: '삭제', style: 'destructive', onPress: () => deleteRecording(id) }
        ]
      );
    };

    const bounceAnim = useRef(new Animated.Value(1)).current; // 애니메이션 초기값

    useEffect(() => {
      // 애니메이션을 반복적으로 실행
      Animated.loop(
        Animated.sequence([
          Animated.spring(bounceAnim, {
            toValue: 1.2, // 크기를 1.2배로 늘림
            friction: 2, // 물리적 마찰 정도
            useNativeDriver: true,
          }),
          Animated.spring(bounceAnim, {
            toValue: 1, // 원래 크기로 복원
            friction: 2,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }, [bounceAnim]); // 빈 배열을 넣어 한 번만 실행되게 설정

    // JSON 문자열을 파싱하는 함수
    const parseJsonData = (jsonString) => {
      try {
        return typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      } catch (error) {
        console.error('JSON 파싱 오류:', error);
        return null;
      }
    };

    // 녹음 목록 렌더링 아이템
    const renderRecordingItem = ({ item }) => (
      <View style={styles.recordingItem}>
        <TouchableOpacity 
          style={styles.recordingInfo}
          onPress={() => processSTT(item)}
          disabled={processingId !== null}  // 다른 파일 처리 중이면 비활성화
        >
          <View style={styles.recordingIcon}>
            {processingId === item.id ? (
              <ActivityIndicator size="small" color="#5c6bc0" />
            ) : (
              <Ionicons name="alert-circle" size={24} color="#ff9800" />
            )}
          </View>
          <View style={styles.recordingDetails}>
            <Text style={styles.recordingDate}>{item.createdAt}</Text>
            <Text style={styles.recordingSize}>{(item.size / 1024).toFixed(2)} KB</Text>
            {processingId === item.id && (
              <Text style={styles.processingText}>텍스트 변환 중...</Text>
            )}
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.deleteButton}
          onPress={() => confirmDelete(item.id)}
          disabled={processingId === item.id}  // 처리 중인 파일은 삭제 불가
        >
          <Ionicons name="close-circle" size={24} color={processingId === item.id ? "#aaa" : "#f44336"} />
        </TouchableOpacity>
      </View>
    );

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setScreen('hospitals')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>음성으로 응급상황을 전달</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* 전체 콘텐츠를 ScrollView로 감싸기 */}
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.content}>
            {/* 녹음 버튼 영역 */}
            <TouchableOpacity
              style={[
                styles.micButton, 
                isRecording && styles.micButtonRecording,
                recordingStatus === 'preparing' && styles.micButtonPreparing,
                recordingStatus === 'stopping' && styles.micButtonStopping
              ]}
              onPress={handleMicPress}
              disabled={recordingStatus === 'preparing' || recordingStatus === 'stopping' || processingId !== null}
            >
              <Animated.View
                style={[
                  {
                    transform: [{ scale: bounceAnim }]
                  }
                ]}
              >
                <Text style={styles.micButtonText}>
                  {isRecording ? '⏹️ 중지' : '🎙️ 녹음'}
                </Text>
              </Animated.View>
            </TouchableOpacity>
            
            {/* 인식된 텍스트 영역 */}
            {recognizedText ? (
              <View style={styles.textResultContainer}>
                <Text style={styles.textResultTitle}>인식된 텍스트</Text>
                {/* 여기서는 중첩 ScrollView를 제거하고 텍스트를 직접 표시 */}
                <View style={styles.textResultBox}>
                  <Text style={styles.textResultContent}>{recognizedText}</Text>
                </View>
                <Text style={styles.textResultHint}>텍스트가 클립보드에 복사되었습니다</Text>
              </View>
            ) : null}

            {/* 환자 분석 결과 */}
            {jsonText ? (
              <View style={styles.analysisContainer}>
                <Text style={styles.analysisTitle}>환자 분석 결과</Text>
                <View style={styles.tableContainer}>
                  {(() => {
                    const patientData = parseJsonData(jsonText);
                  
                    if (!patientData) {
                      return (
                        <View style={styles.errorContainer}>
                          <Text style={styles.errorText}>유효한 환자 데이터가 없습니다</Text>
                        </View>
                      );
                    }
                  
                    return (
                      <View style={styles.table}>
                        {/* 테이블 헤더 */}
                        <View style={styles.tableRow}>
                          <View style={[styles.tableCell, styles.tableHeaderCell, { flex: 1 }]}>
                            <Text style={styles.tableHeaderText}>항목</Text>
                          </View>
                          <View style={[styles.tableCell, styles.tableHeaderCell, { flex: 2 }]}>
                            <Text style={styles.tableHeaderText}>내용</Text>
                          </View>
                        </View>
                      
                        {/* 테이블 내용 */}
                        {Object.entries(patientData).map(([key, value], index) => (
                          <View 
                            key={key} 
                            style={[
                              styles.tableRow, 
                              index % 2 === 0 ? styles.evenRow : styles.oddRow
                            ]}
                          >
                            <View style={[styles.tableCell, { flex: 1 }]}>
                              <Text style={styles.tableCellLabel}>{key}</Text>
                            </View>
                            <View style={[styles.tableCell, { flex: 2 }]}>
                              <Text style={styles.tableCellValue}>
                                {value === null || value === "Null" ? "-" : value}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    );
                  })()}
                </View>
                <Text style={styles.resultHintText}>분석 결과가 저장되었습니다</Text>
              </View>
            ) : null}
            
            {/* 녹음 파일 목록 영역 */}
            <View style={styles.recordingsContainer}>
              <Text style={styles.recordingsTitle}>저장된 녹음 파일</Text>
              
              {recordings.length === 0 ? (
                <Text style={styles.noRecordingsText}>저장된 녹음 파일이 없습니다.</Text>
              ) : (
                // FlatList 대신 일반 매핑 사용 (중첩 스크롤 방지)
                <View style={styles.recordingsList}>
                  {recordings.map(item => (
                    <React.Fragment key={item.id}>
                      {renderRecordingItem({ item })}
                    </React.Fragment>
                  ))}
                </View>
              )}
            </View>
          </View>
        </ScrollView>
        
        <TouchableOpacity style={styles.chatButton} onPress={startWebexChat}>
          <Text>
            <Ionicons name="videocam-outline" size={24} color="black" />
          </Text>
          <Text style={styles.chatButtonText}>의료진과 화상 통화하기</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorText}>{errorMsg}</Text>
      </View>
    );
  }
  if (screen === 'splash') return <SplashScreen />;
  if (screen === 'navigation') return <NavigationScreen />;
  if (screen === 'STT') return <STTScreen />;

  return <HospitalsScreen />;

}




const styles = StyleSheet.create({
  // 기본 컨테이너 스타일
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scrollContainer: { 
    flex: 1, 
    width: '100%', 
  },
  scrollContent: { 
    paddingBottom: 20, // 하단 패딩 추가하여 마지막 항목이 잘 보이도록
  },
  content: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    flexGrow: 1, // flexGrow 추가하여 스크롤이 가능하도록
  },

  // 헤더 관련 스타일
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  searchButton: {
    padding: 8,
  },
  closeButton: {
    padding: 8,
  },
  webexTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  webexHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },

  // 기본 텍스트 스타일
  errorText: {
    color: 'red',
    textAlign: 'center',
    fontSize: 16,
  },
  message: {
    fontSize: 20,
    color: '#fff',
    marginBottom: 40,
    textAlign: 'center',
  },
  dateText: {
    fontWeight: '500',
    color: '#444',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },

  // 리스트 관련 스타일
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  hospitalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F7F7F7',
    marginVertical: 6,
  },
  highlightedItem: {
    backgroundColor: '#FFF4D6',
  },
  iconContainer: {
    width: 40,
    height: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  hospitalInfo: {
    flex: 1,
  },
  hospitalName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  departmentText: {
    fontSize: 14,
    color: '#666',
  },
  distanceText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 10,
  },

  // 버튼 관련 스타일
  baseButton: {
    borderRadius: 20,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sttButton: {
    position: 'absolute',
    bottom: 40,
    right: 24,
    left: 24,
    backgroundColor: '#4A90E2',
    borderRadius: 20,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sttButtonText: {
    color: 'white',
    fontSize: 16,
    marginLeft: 10,
    fontWeight: '600',
  },
  chatButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    left: 24,
    backgroundColor: '#FFE082',
    borderRadius: 20,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chatButtonText: {
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 16,
  },
  startButton: {
    backgroundColor: '#FFE082',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 30,
  },
  startButtonText: {
    color: 'black',
    fontSize: 18,
    fontWeight: 'bold',
  },
  emergencyButton: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    backgroundColor: '#000',
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  emergencyButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  kakaoNaviButton: {
    marginTop: 16,
    marginHorizontal: 16,
    backgroundColor: '#FFCD00',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  kakaoNaviButtonText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  micButton: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#5c6bc0',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    alignSelf: 'center',
    marginBottom: 20,
  },
  micButtonRecording: {
    backgroundColor: '#ef5350',
  },
  micButtonPreparing: {
    backgroundColor: '#ffb74d',
  },
  micButtonStopping: {
    backgroundColor: '#9575cd',
  },
  micButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: 8,
  },

  // Splash 스크린 관련 스타일
  splashContainer: {
    flex: 1,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashContent: {
    alignItems: 'center',
    padding: 30,
  },
  splashTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 16,
  },
  splashMessage: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 48,
    color: '#666',
    lineHeight: 26,
  },

  // 맵 관련 스타일
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#e5e5e5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapMarker: {
    position: 'absolute',
    backgroundColor: '#FF5252',
    padding: 8,
    borderRadius: 20,
  },
  ambulanceIcon: {
    position: 'absolute',
    right: '30%',
    bottom: '30%',
    backgroundColor: '#4285F4',
    padding: 8,
    borderRadius: 20,
  },
  mapWrapper: {
    flex: 1,
  },
  mapView: {
    flex: 1,
  },
  staticMapImage: {
    width: '100%',
    height: 300,
    borderRadius: 10,
    marginBottom: 10,
  },
  timeDisplay: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  timeText: {
    color: 'white',
    marginLeft: 6,
    fontWeight: '600',
  },
  routeInfo: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  routeInfoItem: {
    flex: 1,
    alignItems: 'center',
  },
  routeInfoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  routeInfoValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  routeDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 16,
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D0D0D0',
    marginHorizontal: 4,
  },

  // WebView 관련 스타일
  webView: {
    flex: 1,
  },
  webViewLoading: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },

  // 통일된 결과 컨테이너 스타일 - 공통
  resultContainerBase: {
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  resultTitleBase: {
    color: 'white',
    fontWeight: 'bold',
    padding: 12,
    fontSize: 16,
  },
  resultHintBase: {
    textAlign: 'center',
    fontSize: 12,
    color: '#6b7280',
    paddingVertical: 8,
  },
  scrollBoxBase: {
    maxHeight: 200,
  },
  scrollContentBase: {
    padding: 12,
  },
  contentTextBase: {
    fontSize: 14,
    color: '#374151',
  },

  analysisContainer: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 16,
    marginTop: 10,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    borderWidth: 1,
    borderColor: '#d3d3d3',
  },
  analysisTitle: {
    backgroundColor: '#3b82f6', // 파란색 헤더
    color: 'white',
    fontWeight: 'bold',
    padding: 12,
    fontSize: 16,
  },
  tableContainer: {
    width: '100%',
    backgroundColor: '#fff',
    padding: 8,
  },
  table: {
    width: '100%',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  evenRow: {
    backgroundColor: '#f9fafb',
  },
  oddRow: {
    backgroundColor: 'white',
  },
  tableCell: {
    padding: 12,
    justifyContent: 'center',
  },
  tableHeaderCell: {
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
  },
  tableHeaderText: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#111827',
  },
  tableCellLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  tableCellValue: {
    fontSize: 14,
    color: '#374151',
  },
  resultHintText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#6b7280',
    paddingVertical: 8,
  },
  


  // 인식된 텍스트 결과
  textResultContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    maxHeight: '30%', // 분석결과보다 작게
  },
  textResultTitle: {
    backgroundColor: '#10b981', // 녹색 헤더
    color: 'white',
    fontWeight: 'bold',
    padding: 12,
    fontSize: 16,
  },
  textResultScrollBox: {
    maxHeight: null, // 스크롤 제거
  },
  textResultBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8, 
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textResultScrollContent: {
    padding: 12,
  },
  textResultContent: {
    fontSize: 14,
    color: '#374151',
  },
  textResultHint: {
    textAlign: 'center',
    fontSize: 12,
    color: '#6b7280',
    paddingVertical: 8,
  },

  // 저장된 녹음 파일 관련 스타일
  recordingsContainer: {
    flex: 0, // 고정 높이 제거
    width: '100%',
    marginTop: 15,
    borderColor: '#d3d3d3',
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: 'white',
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  recordingsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    padding: 12,
    color: 'white',
    backgroundColor: '#9575cd', // 보라색 헤더
  },
  recordingsList: {
    marginTop: 8, // FlatList 대신 사용하므로 스타일 조정
  },
  noRecordingsText: {
    margin: 10,
    color: '#666',
    textAlign: 'center',
  },
  recordingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    marginVertical: 6,
    marginHorizontal: 10,
    padding: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  recordingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingIcon: {
    marginRight: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingDetails: {
    flex: 1,
  },
  recordingDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  recordingSize: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  processingText: {
    fontSize: 12,
    color: '#5c6bc0',
    marginTop: 4,
    fontStyle: 'italic',
  },
  
  // 에러 관련 스타일
  errorContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
  },
});