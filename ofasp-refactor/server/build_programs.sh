#!/bin/bash

set -e

echo "🔨 OpenASP Java 패키지 빌드 스크립트"
echo "============================================="
echo "java_src/com 하위의 모든 Java 파일을 컴파일하여 JAR 파일 생성"
echo ""

BASE_DIR="/home/aspuser/app/server"
JAVA_SRC_DIR="$BASE_DIR/java_src"
JAVA_CLASSES_DIR="$BASE_DIR/java_classes"
JAVA_JARS_DIR="$BASE_DIR/java_jars"

echo "📁 디렉토리 구조 생성 중..."
mkdir -p "$JAVA_CLASSES_DIR"
mkdir -p "$JAVA_JARS_DIR"

echo "🧹 이전 컴파일 결과 삭제 중..."
rm -rf "$JAVA_CLASSES_DIR"/*
rm -f "$JAVA_JARS_DIR"/*.jar

echo ""
echo "🔍 Java 소스 파일 확인 중..."
echo "--------------------------------"

if [ ! -d "$JAVA_SRC_DIR/com" ]; then
    echo "❌ Java 소스 디렉토리가 존재하지 않습니다: $JAVA_SRC_DIR/com"
    echo "💡 java_src/com/openasp/ 이하에 Java 파일을 배치해주세요"
    exit 1
fi

JAVA_FILES=$(find "$JAVA_SRC_DIR" -name "*.java" 2>/dev/null || true)

if [ -z "$JAVA_FILES" ]; then
    echo "❌ Java 소스 파일을 찾을 수 없습니다"
    echo "💡 $JAVA_SRC_DIR/com/openasp/ 이하에 .java 파일을 배치해주세요"
    exit 1
fi

echo "✅ 발견된 Java 파일:"
echo "$JAVA_FILES" | while read file; do
    if [ -n "$file" ]; then
        relative_path=${file#$JAVA_SRC_DIR/}
        echo "   📄 $relative_path"
    fi
done

JAVA_FILE_COUNT=$(echo "$JAVA_FILES" | wc -l)
echo ""
echo "📊 총계: ${JAVA_FILE_COUNT}개 Java 파일"

echo ""
echo "📦 패키지 구조 확인 중..."
echo "--------------------------------"

if [ -d "$JAVA_SRC_DIR/com/openasp" ]; then
    echo "✅ com.openasp 패키지 구조 확인"
    
    for subpkg in launcher core menu login eigyo uriage user system common; do
        if [ -d "$JAVA_SRC_DIR/com/openasp/$subpkg" ]; then
            file_count=$(find "$JAVA_SRC_DIR/com/openasp/$subpkg" -name "*.java" | wc -l)
            if [ $file_count -gt 0 ]; then
                echo "   📦 com.openasp.$subpkg (${file_count} 파일)"
            fi
        fi
    done
else
    echo "⚠️  표준 패키지 구조가 없습니다"
    echo "💡 권장 구조: java_src/com/openasp/{launcher,core,menu,login,eigyo,uriage,user,system,common}"
fi

echo ""
echo "☕ Java 소스 컴파일 중..."
echo "--------------------------------"

cd "$BASE_DIR"

JAVAC_OPTS="-d $JAVA_CLASSES_DIR -cp $JAVA_CLASSES_DIR -encoding UTF-8"

EXTERNAL_LIBS=""
if [ -f "/usr/share/java/gson.jar" ]; then
    EXTERNAL_LIBS="$EXTERNAL_LIBS:/usr/share/java/gson.jar"
elif [ -f "$BASE_DIR/lib/gson.jar" ]; then
    EXTERNAL_LIBS="$EXTERNAL_LIBS:$BASE_DIR/lib/gson.jar"
fi

if [ -n "$EXTERNAL_LIBS" ]; then
    JAVAC_OPTS="$JAVAC_OPTS -cp $JAVA_CLASSES_DIR$EXTERNAL_LIBS"
    echo "📚 외부 라이브러리 감지: $EXTERNAL_LIBS"
fi

echo "🚀 컴파일 시작..."
echo "   명령어: javac $JAVAC_OPTS [Java 파일들]"

if javac $JAVAC_OPTS $JAVA_FILES; then
    echo "   ✅ Java 컴파일 성공"
else
    echo "   ❌ Java 컴파일 실패"
    echo "💡 에러 내용을 확인하고 Java 소스를 수정해주세요"
    exit 1
fi

echo ""
echo "🔍 컴파일 결과 확인 중..."
echo "--------------------------------"

CLASS_COUNT=$(find "$JAVA_CLASSES_DIR" -name "*.class" | wc -l)
echo "📊 컴파일된 클래스 파일: ${CLASS_COUNT}개"

if [ $CLASS_COUNT -eq 0 ]; then
    echo "❌ 클래스 파일이 생성되지 않았습니다"
    exit 1
fi

echo "📁 생성된 패키지 구조:"
find "$JAVA_CLASSES_DIR" -type d -name "com" -exec find {} -type d \; | sort | while read dir; do
    relative_path=${dir#$JAVA_CLASSES_DIR/}
    if [ -n "$relative_path" ]; then
        class_count=$(find "$dir" -maxdepth 1 -name "*.class" | wc -l)
        if [ $class_count -gt 0 ]; then
            echo "   📦 $relative_path (${class_count} 클래스)"
        else
            echo "   📁 $relative_path"
        fi
    fi
done

echo ""
echo "📝 매니페스트 파일 생성 중..."
echo "--------------------------------"

MANIFEST_FILE="$JAVA_CLASSES_DIR/MANIFEST.MF"
cat > "$MANIFEST_FILE" << EOF
Manifest-Version: 1.0
Main-Class: com.openasp.launcher.OpenASPLauncher
Created-By: OpenASP Build System
Implementation-Title: OpenASP Java Programs
Implementation-Version: 2.0
Built-Date: $(date '+%Y-%m-%d %H:%M:%S')
Package-Structure: com.openasp.*
Encoding: UTF-8
EOF

echo "✅ 매니페스트 파일 생성됨"
echo "   메인 클래스: com.openasp.launcher.OpenASPLauncher"

echo ""
echo "📦 JAR 파일 생성 중..."
echo "--------------------------------"

cd "$JAVA_CLASSES_DIR"

JAR_FILE="$JAVA_JARS_DIR/ofasp.jar"

echo "🔨 JAR 생성 시작..."
if jar cfm "$JAR_FILE" "$MANIFEST_FILE" com/; then
    echo "   ✅ ofasp.jar 생성 완료"
    
    if [ -f "$JAR_FILE" ]; then
        JAR_SIZE=$(du -h "$JAR_FILE" | cut -f1)
        echo "   📏 JAR 파일 크기: $JAR_SIZE"
        echo "   📍 저장 경로: $JAR_FILE"
    fi
else
    echo "   ❌ JAR 파일 생성 실패"
    exit 1
fi

echo ""
echo "🔍 JAR 파일 내용 확인 중..."
echo "--------------------------------"

echo "📋 JAR 파일 내 클래스 목록 (상위 10개):"
jar tf "$JAR_FILE" | grep '\.class$' | sort | head -10 | while read class; do
    echo "   📄 $class"
done

TOTAL_CLASSES=$(jar tf "$JAR_FILE" | grep -c '\.class$' || echo "0")
if [ $TOTAL_CLASSES -gt 10 ]; then
    echo "   ... 외 $((TOTAL_CLASSES - 10))개 클래스"
fi

echo ""
echo "📊 JAR 파일 요약:"
echo "   총 클래스 수: ${TOTAL_CLASSES}개"
echo "   패키지 수: $(jar tf "$JAR_FILE" | grep '/$' | grep -c 'openasp' || echo "0")개"

echo ""
echo "⚙️  설정 파일 확인 중..."
echo "--------------------------------"

CONFIG_DIR="/home/aspuser/app/src"
SMED_PGM_CONFIG="$CONFIG_DIR/smed_pgm.json"

if [ -f "$SMED_PGM_CONFIG" ]; then
    echo "✅ smed_pgm.json 존재 확인"
    
    if command -v python3 >/dev/null 2>&1; then
        if python3 -m json.tool "$SMED_PGM_CONFIG" >/dev/null 2>&1; then
            echo "   ✅ JSON 문법 정상"
	    if [ -f "$BASE_DIR/count_program.py" ] && [ -f "$SMED_PGM_CONFIG" ]; then
cat > /tmp/count_programs.py << EOF
import json
import sys
try:
    if len(sys.argv) > 1:
        with open(sys.argv[1], 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(len(data.get('programs', {})))
    else:
        print('0')
except:
    print('0')
EOF

                PROGRAM_COUNT=$(python3 "/tmp/count_programs.py" "$SMED_PGM_CONFIG" 2>/dev/null || echo "0")
		rm /tmp/count_programs.py 
                echo "   📊 정의된 프로그램: ${PROGRAM_COUNT}개"
            else
                echo "   📊 정의된 프로그램: 확인 불가"
            fi
        else
            echo "   ⚠️  JSON 문법 에러 있음"
        fi
    fi
else
    echo "⚠️  smed_pgm.json 이 없습니다"
    echo "💡 설정 파일을 생성해주세요: $SMED_PGM_CONFIG"
fi

echo ""
echo "🎉 빌드 완료 요약"
echo "================================="
echo ""
echo "📊 빌드 결과:"
echo "   소스 파일: ${JAVA_FILE_COUNT}개"
echo "   클래스 파일: ${CLASS_COUNT}개"
echo "   JAR 파일: $([ -f "$JAR_FILE" ] && echo "생성됨 ($JAR_SIZE)" || echo "생성 실패")"
echo ""
echo "📁 출력 파일:"
echo "   JAR 파일: $JAR_FILE"
echo "   클래스 디렉토리: $JAVA_CLASSES_DIR"
echo ""

echo "🧪 테스트 실행 방법:"
echo "--------------------------------"
echo ""
echo "1. JAR 파일 직접 테스트:"
echo "   java -jar $JAR_FILE com.openasp.core.PGM1"
echo "   echo '{\"user_id\":\"admin\"}' | java -jar $JAR_FILE com.openasp.menu.MenuProgram"
echo ""
echo "2. 사용 가능 클래스 확인:"
echo "   jar tf $JAR_FILE | grep '\\.class$'"
echo ""
echo "3. API 서버 실행:"
echo "   cd $BASE_DIR && python3 api_server.py"
echo ""
echo "4. 패키지 테스트:"
echo "   curl http://localhost:8000/api/java/packages"
echo ""

echo "🚀 다음 스텝:"
echo "--------------------------------"
echo "1. API 서버 실행: python3 api_server.py"
echo "2. 웹 브라우저로 http://localhost:3000 에 접속"
echo "3. 각종 맵 테스트:"
echo "   - LOGO (Java 로그인)"
echo "   - MENU (Java 메뉴)"
echo "   - EIGYO001 (Java 영업관리)"
echo "4. 새로운 Java 프로그램 추가 시 재차 이 스크립트 실행"
echo ""
echo "✅ 모든 Java 프로그램이 패키지 구조로 성공적으로 빌드되었습니다!"
echo ""

if [ $JAVA_FILE_COUNT -lt 5 ]; then
    echo "⚠️  주의: Java 파일이 적습니다 ($JAVA_FILE_COUNT개)"
    echo "💡 필요한 기본 클래스가 누락되어 있을 수 있습니다"
    echo "   필수 클래스: OpenASPLauncher, PGM1, PGM2, MenuProgram"
fi

if [ ! -f "$BASE_DIR/api_server.py" ]; then
    echo "⚠️  주의: api_server.py 가 없습니다"
    echo "💡 API 서버 파일을 배치해주세요: $BASE_DIR/api_server.py"
fi

echo ""
echo "🕐 빌드 스크립트 실행 완료: $(date '+%Y-%m-%d %H:%M:%S')"