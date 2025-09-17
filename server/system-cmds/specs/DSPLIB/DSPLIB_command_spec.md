• DSPLIB (라이브러리의 표시: Display Library) DSPLIB 커맨드는 라이브러리 내용, 즉 라이브러리에 등록된 엔티티를 표시하는 데 사용됩니다. COBOLG나 CL 프로그램의 소스 텍스트는 라이브러리의 엔티티로 관리되므로, 이 커맨드를 사용하여 소스를 조회할 수 있습니다.
• 주요 파라미터는 다음과 같습니다:
    ◦ LIB: 소스 프로그램이 저장된 라이브러리 이름을 지정합니다.
    ◦ TYPE: 엔티티 속성을 지정합니다. 소스 텍스트를 조회하려면 **@SRC**를 지정해야 합니다. @SRC는 COBOL G 原始プログラム (@CBLG) 및 制御言語原始プログラム (@CL)과 같은 원시 텍스트(source text)를 포함합니다.
    ◦ ENT: 조회할 엔티티(프로그램) 이름을 지정합니다.
    ◦ OUTPUT: 출력 대상을 지정합니다. 화면에 표시하려면 **@DSP**를 지정합니다. 출력 대상을 지정하지 않으면, 시스템 공통 변수 @OUTPUT의 값에 따릅니다.
• 예시: DSPLIB LIB-YOURPROGRAMLIB, TYPE-@SRC, ENT-YOURCOBOLGPROGRAM, OUTPUT-@DSP (이는 'YOURPROGRAMLIB' 라이브러리에 있는 'YOURCOBOLGPROGRAM'이라는 COBOL G 소스 프로그램을 화면에 표시합니다.)