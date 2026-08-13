        function showPremiumGallery() {
    console.log('showPremiumGallery вызван, stats.memories:', stats.memories);
    if (!window.gsap) {
        console.error("GSAP не найден, fallback на простую галерею.");
        return showSimpleGallery();
    }

    const isRussian = stats.language === "ru";
    const fontFamily = isRussian ? 'GoodVibesCyr, cursive' : 'GreatVibes, cursive';
    const galleryContainer = document.getElementById('gallery-container');
    const startScreen = document.getElementById('start-screen');
    
    // Отключаем прокрутку страницы
    document.body.style.overflow = 'hidden';
    
    galleryContainer.style.display = 'flex';
    galleryContainer.setAttribute('data-gallery', 'true');
    startScreen.style.display = 'none';

    galleryContainer.innerHTML = '';

    // Заголовок "Коллекционные карточки"
    const galleryHeader = document.createElement('div');
    galleryHeader.className = 'gallery-header';
    galleryHeader.style.fontFamily = fontFamily;
    galleryHeader.textContent = isRussian ? "Коллекционные карточки" : "Collection Cards";

    // Подзаголовок "Прошлое остается навсегда"
    const subHeader = document.createElement('div');
    subHeader.style.cssText = `
        color: #F5E6C9; font-size: 2rem; text-align: center; 
        margin-bottom: 10px; text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    `;
    subHeader.style.fontFamily = fontFamily;
    subHeader.textContent = isRussian ? "Прошлое остается навсегда" : "The past remains forever";

    // Надпись "Серия: Романтика 0/4"
    const seriesTitle = document.createElement('div');
    seriesTitle.className = 'series-title';
    seriesTitle.style.cssText = `
        color: #e0c18e; font-size: 1.5rem; margin-bottom: 1rem; 
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3); text-align: center;
    `;
    seriesTitle.style.fontFamily = fontFamily;
    const unlockedCount = cardSeries["romance"].cards.filter(card => stats.memories?.includes(card.id)).length;
    seriesTitle.textContent = isRussian 
        ? `Серия: Романтика ${unlockedCount}/4`
        : `Series: Romance ${unlockedCount}/4`;

    // Кнопка переключения серий "Романтика"
    const seriesButton = document.createElement('button');
    seriesButton.style.cssText = `
        background: linear-gradient(to bottom, #8C6F4A, #5A3F2A);
        color: #F5E6C9; border: none; padding: 8px 16px; border-radius: 20px;
        font-weight: bold; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
        margin-bottom: 20px; cursor: pointer;
    `;
    seriesButton.style.fontFamily = fontFamily;
    seriesButton.textContent = isRussian ? "Романтика" : "Romance";

    // Контейнер для карточек
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'cards-container';

    // Кнопки переключения
    const prevButton = document.createElement('button');
    prevButton.textContent = '<';
    prevButton.style.cssText = `
        position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
        background: #8C6F4A; color: #F5E6C9; border: none; padding: 10px 15px;
        border-radius: 50%; font-size: 1.5rem; cursor: pointer;
    `;

    const nextButton = document.createElement('button');
    nextButton.textContent = '>';
    nextButton.style.cssText = `
        position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
        background: #8C6F4A; color: #F5E6C9; border: none; padding: 10px 15px;
        border-radius: 50%; font-size: 1.5rem; cursor: pointer;
    `;

    // Кнопка закрытия
    const closeButton = document.createElement('button');
    closeButton.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 6L6 18M6 6L18 18" stroke="#e0c18e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
    closeButton.style.cssText = `
        position: absolute; top: 1rem; right: 1rem; background: transparent;
        border: none; color: #e0c18e; font-size: 1.5rem; cursor: pointer;
        opacity: 0; width: 40px; height: 40px; display: flex;
        align-items: center; justify-content: center; border-radius: 50%;
        transition: background 0.3s;
    `;
    closeButton.onmouseover = () => closeButton.style.background = 'rgba(224, 193, 142, 0.2)';
    closeButton.onmouseout = () => closeButton.style.background = 'transparent';

    // Сборка элементов
    galleryContainer.appendChild(galleryHeader);
    galleryContainer.appendChild(subHeader);
    galleryContainer.appendChild(seriesTitle);
    galleryContainer.appendChild(seriesButton);
    galleryContainer.appendChild(prevButton);
    galleryContainer.appendChild(nextButton);
    galleryContainer.appendChild(cardsContainer);
    galleryContainer.appendChild(closeButton);

    // Звуки
    const clickSound = new Audio('assets/sounds/sfx_camera_click.mp3');
    clickSound.load();

    // Анимация появления
    gsap.to(galleryContainer, {
        opacity: 1,
        duration: 0.5,
        ease: "power2.out",
        onComplete: () => {
            gsap.to(galleryHeader, { opacity: 1, y: 0, duration: 0.8, ease: "back.out(1.7)" });
            gsap.to(subHeader, { opacity: 1, y: 0, duration: 0.8, delay: 0.1, ease: "back.out(1.7)" });
            gsap.to(seriesTitle, { opacity: 1, y: 0, duration: 0.8, delay: 0.2, ease: "back.out(1.7)" });
            gsap.to(seriesButton, { opacity: 1, duration: 0.8, delay: 0.3, ease: "power2.out" });
            gsap.to(prevButton, { opacity: 1, duration: 0.5, delay: 0.4, ease: "power2.out" });
            gsap.to(nextButton, { opacity: 1, duration: 0.5, delay: 0.4, ease: "power2.out" });
            gsap.to(closeButton, { opacity: 1, duration: 0.5, delay: 0.4, ease: "power2.out" });
            switchSeries('romance', cardsContainer, clickSound, isRussian);
        }
    });

    // Логика переключения карточек
    let currentFrontIndex = 0;
    const cardCount = cardSeries['romance'].cards.length;

    function updateCards() {
        cardSeries['romance'].cards.forEach((card, index) => {
            const cardElement = cardsContainer.querySelector(`[data-card-id="${card.id}"]`);
            const relativeIndex = (index - currentFrontIndex + cardCount) % cardCount;
            const zStep = 150;
            const angleStep = 15;
            const screenWidth = window.innerWidth;
            const cardWidth = 250;
            const maxVisibleWidth = Math.min(screenWidth - 20, 500);

            gsap.to(cardElement, {
                z: relativeIndex * zStep,
                rotateY: relativeIndex * angleStep,
                opacity: 1 - relativeIndex * 0.2,
                scale: Math.min(1 - relativeIndex * 0.05, maxVisibleWidth / cardWidth),
                zIndex: cardCount - relativeIndex,
                duration: 0.8,
                ease: "power2.inOut"
            });
        });
    }

    // Обработчики событий
    addEventListeners(seriesButton, ['click', 'touchstart'], () => {
        switchSeries('romance', cardsContainer, clickSound, isRussian);
        clickSound.play().catch(err => console.warn("Ошибка звука:", err));
    });

    addEventListeners(prevButton, ['click', 'touchstart'], () => {
        currentFrontIndex = (currentFrontIndex - 1 + cardCount) % cardCount;
        updateCards();
        clickSound.play().catch(err => console.warn("Ошибка звука:", err));
    });

    addEventListeners(nextButton, ['click', 'touchstart'], () => {
        currentFrontIndex = (currentFrontIndex + 1) % cardCount;
        updateCards();
        clickSound.play().catch(err => console.warn("Ошибка звука:", err));
    });

    addEventListeners(closeButton, ['click', 'touchstart'], () => {
        document.body.style.overflow = ''; // Восстанавливаем прокрутку
        closeGallery();
        clickSound.play().catch(err => console.warn("Ошибка звука:", err));
    });
}


   function switchSeries(seriesKey, cardsContainer, clickSound, isRussian) {
    console.log('switchSeries вызван для:', seriesKey);
    const series = cardSeries[seriesKey];
    if (!series) return;

    cardsContainer.innerHTML = '';
    const cardCount = series.cards.length;
    const zStep = 220; // Увеличенное расстояние для удобного тапа
    const angleStep = 20; // Увеличенный угол для видимости
    const screenWidth = window.innerWidth;
    const cardWidth = 350; // Уменьшенная ширина карточек
    const maxVisibleWidth = Math.min(screenWidth - 20, 500); // Ограничение по ширине экрана

    series.cards.forEach((card, index) => {
        const cardElement = createCardElement(card, seriesKey, cardsContainer, clickSound, isRussian);
        const zPosition = index * zStep;
        const rotateY = index * angleStep;

        gsap.set(cardElement, {
            z: zPosition,
            rotateY: rotateY,
            opacity: 1 - index * 0.2,
            scale: Math.min(1 - index * 0.03, maxVisibleWidth / cardWidth),
        });

        cardElement.style.zIndex = cardCount - index;
        cardsContainer.appendChild(cardElement);

        addEventListeners(cardElement, ['click', 'touchstart'], (e) => {
            e.preventDefault();
            if (stats.memories?.includes(card.id)) {
                showCardDetail(card, isRussian, clickSound);
            }
            // Заблокированные карточки можно листать кнопками, но не открывать
        });
    });
}

function createCardElement(card, seriesKey, cardsContainer, clickSound, isRussian) {
    const isUnlocked = stats.memories?.includes(card.id);
    const cardElement = document.createElement('div');
    cardElement.className = 'premium-card';
    cardElement.dataset.cardId = card.id;
    if (!isUnlocked) cardElement.classList.add('locked');

    if (isUnlocked) {
        const cardImg = document.createElement('img');
        cardImg.src = `assets/memories/${card.id}.png`;
        cardImg.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
        cardElement.appendChild(cardImg);

        const shineEffect = document.createElement('div');
        shineEffect.className = 'card-shine-effect';
        cardElement.appendChild(shineEffect);

        const cardName = document.createElement('div');
        cardName.className = 'card-name';
        cardName.style.fontFamily = isRussian ? 'GoodVibesCyr, cursive' : 'GreatVibes, cursive';
        cardName.textContent = isRussian ? card.name : card.nameEn;
        cardElement.appendChild(cardName);
    } else {
        const lockImg = document.createElement('img');
        lockImg.src = 'assets/memories/card_locked.png';
        lockImg.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
        cardElement.appendChild(lockImg);

        const unlockText = document.createElement('div');
        unlockText.className = 'unlock-text';
        unlockText.style.fontFamily = isRussian ? 'GoodVibesCyr, cursive' : 'GreatVibes, cursive';
        const diamondIcon = `<img src="assets/ui/diamonds.png" style="width: 16px; height: 16px; vertical-align: middle;">`;
        unlockText.innerHTML = isRussian 
            ? `Разблокировка: ${card.unlock} ${diamondIcon}` 
            : `Unlock: ${card.unlockEn} ${diamondIcon}`;
        cardElement.appendChild(unlockText);

        const unlockButton = document.createElement('button');
        unlockButton.className = 'card-unlock-button';
        unlockButton.style.fontFamily = isRussian ? 'GoodVibesCyr, cursive' : 'GreatVibes, cursive';
        unlockButton.textContent = isRussian ? "Разблокировать" : "Unlock";
        unlockButton.onclick = (e) => {
            e.stopPropagation(); // Предотвращаем срабатывание перелистывания
            unlockCard(card, cardsContainer, clickSound, isRussian);
        };
        cardElement.appendChild(unlockButton);
    }

    return cardElement;
}

    function unlockCard(card, cardsContainer, clickSound, isRussian) {
    const unlockCost = card.unlock; // Количество бриллиантов для разблокировки
    const hasEnoughDiamonds = stats.diamonds >= unlockCost; // Предполагаем, что stats.diamonds хранит бриллианты
    const isSecondPlaythrough = stats.playthroughs > 1; // Предполагаем, что stats.playthroughs отслеживает прохождения

    if (hasEnoughDiamonds || isSecondPlaythrough) {
        if (hasEnoughDiamonds) {
            stats.diamonds -= unlockCost; // Списываем бриллианты
            console.log(`Потрачено ${unlockCost} бриллиантов`);
        } else {
            console.log("Разблокировано за второе прохождение");
        }

        // Добавляем карточку в разблокированные
        if (!stats.memories) stats.memories = [];
        stats.memories.push(card.id);
        saveProfile();

        // Обновляем карточку в галерее
        const cardElement = cardsContainer.querySelector(`[data-card-id="${card.id}"]`);
        cardElement.classList.remove('locked');
        cardElement.innerHTML = ''; // Очищаем содержимое

        const cardImg = document.createElement('img');
        cardImg.src = `assets/memories/${card.id}.png`;
        cardImg.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
        cardElement.appendChild(cardImg);

        const shineEffect = document.createElement('div');
        shineEffect.className = 'card-shine-effect';
        cardElement.appendChild(shineEffect);

        const cardName = document.createElement('div');
        cardName.className = 'card-name';
        cardName.style.fontFamily = isRussian ? 'GoodVibesCyr, cursive' : 'GreatVibes, cursive';
        cardName.textContent = isRussian ? card.name : card.nameEn;
        cardElement.appendChild(cardName);

        // Проигрываем звук разблокировки
        const unlockSound = new Audio('assets/sounds/sfx_card_unlock.mp3');
        unlockSound.play().catch(err => console.warn("Ошибка звука:", err));
        clickSound.play().catch(err => console.warn("Ошибка звука:", err));
    } else {
        console.log("Недостаточно бриллиантов или не второе прохождение");
        // Здесь можно добавить уведомление для пользователя
    }
}
    function showUnlockNotification(card, isRussian) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: linear-gradient(to bottom, #D9C2A7, #BFA78A); border: 2px dashed #8C6F4A;
            border-radius: 10px; padding: 20px; color: #333; text-align: center;
            z-index: 2000; max-width: 300px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
            opacity: 0;
        `;
        notification.innerHTML = `
            <div style="font-size: 1.5rem; color: #8C6F4A; margin-bottom: 10px; font-family: ${isRussian ? 'GoodVibesCyr' : 'GreatVibes'}, cursive;">
                ${isRussian ? 'Карта разблокирована!' : 'Card Unlocked!'}
            </div>
            <div style="font-size: 1.2rem; margin-bottom: 15px; font-family: ${isRussian ? 'GoodVibesCyr' : 'GreatVibes'}, cursive;">
                ${isRussian ? card.name : card.nameEn}
            </div>
            <img src="assets/memories/${card.id}.png" alt="Card" style="width: 100%; border-radius: 5px; margin-bottom: 15px;">
            <button style="
                background: linear-gradient(to bottom, #8C6F4A, #5A3F2A);
                color: #F5E6C9; border: none; padding: 10px 20px; border-radius: 20px;
                font-weight: bold; cursor: pointer; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
                font-family: ${isRussian ? 'GoodVibesCyr' : 'GreatVibes'}, cursive;
            ">${isRussian ? 'Супер!' : 'Awesome!'}</button>
        `;
        document.body.appendChild(notification);

        gsap.to(notification, {
            opacity: 1,
            duration: 0.5,
            ease: "power2.out",
            onComplete: () => {
                const closeBtn = notification.querySelector('button');
                closeBtn.onclick = () => {
                    gsap.to(notification, {
                        opacity: 0,
                        duration: 0.3,
                        ease: "power2.in",
                        onComplete: () => document.body.removeChild(notification)
                    });
                };
            }
        });
    }

    function showCardDetail(card, isRussian, clickSound) {
        const detailContainer = document.createElement('div');
        detailContainer.className = 'card-detail';
        detailContainer.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 350px; height: 350px; background: linear-gradient(to bottom, #F5E6C9, #E6D7A8);
            border-radius: 5px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7); z-index: 3000;
        `;

        const img = document.createElement('img');
        img.src = `assets/memories/${card.id}.png`;
        img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
        detailContainer.appendChild(img);

        const name = document.createElement('div');
        name.style.fontFamily = isRussian ? 'GoodVibesCyr, cursive' : 'GreatVibes, cursive';
        name.textContent = isRussian ? card.name : card.nameEn;
        name.style.cssText = 'position: absolute; bottom: 0; width: 100%; text-align: center; padding: 5px; color: #333; font-size: 1.2rem;';
        detailContainer.appendChild(name);

        document.body.appendChild(detailContainer);
        document.getElementById('gallery-container').style.background = 'rgba(0, 0, 0, 0.8)';

        addEventListeners(detailContainer, ['click', 'touchstart'], () => {
            document.body.removeChild(detailContainer);
            document.getElementById('gallery-container').style.background = "url('assets/backgrounds/shoebox_texture.png') center / cover no-repeat";
            clickSound.play().catch(err => console.warn("Ошибка звука:", err));
        });
    }
	    
         function closeGallery() {
    console.log('closeGallery вызван');
    const galleryContainer = document.getElementById('gallery-container');
    const startScreen = document.getElementById('start-screen');

    if (galleryContainer) {
        gsap.to(galleryContainer, {
            opacity: 0,
            duration: 0.5,
            ease: "power2.in",
            onComplete: () => {
                galleryContainer.innerHTML = ''; // Очищаем содержимое
                galleryContainer.style.display = 'none';
                startScreen.style.display = 'flex'; // Возвращаем стартовый экран
                startScreen.style.pointerEvents = 'auto';
                startScreen.style.zIndex = '3000';
            }
        });
    }

    if (startScreen) {
        startScreen.style.display = 'flex';
        startScreen.style.pointerEvents = 'auto';
        startScreen.style.zIndex = '3000';
    }
}


                       function showSimpleGallery() {
            console.log("Показываем простую галерею без GSAP");
            const galleryDiv = document.createElement('div');
            galleryDiv.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                background: rgba(0, 0, 0, 0.9); z-index: 10; overflow-y: auto;
            `;

            const galleryTitle = document.createElement('h2');
            galleryTitle.style.cssText = `
                color: #e0c18e; text-align: center; margin: 20px 0; 
                font-family: ${stats.language === "ru" ? 'GoodVibesCyr' : 'GreatVibes'}, cursive; font-size: 36px;
            `;
            galleryTitle.textContent = stats.language === "ru" ? "Коллекционные карточки" : "Collection Cards";
            galleryDiv.appendChild(galleryTitle);

            if (stats.memories?.length > 0) {
                stats.memories.forEach(memory => {
                    const cardWrapper = document.createElement('div');
                    cardWrapper.style.cssText = 'display: inline-block; margin: 15px; position: relative;';
                    const img = document.createElement('img');
                    img.src = `assets/memories/${memory}.png`;
                    img.style.cssText = 'display: block; max-width: 300px; border: 8px solid #e0c18e; border-radius: 5px;';
                    img.onerror = () => {
                        console.warn(`Воспоминание ${memory}.png не найдено`);
                        cardWrapper.remove();
                    };
                    cardWrapper.appendChild(img);
                    galleryDiv.appendChild(cardWrapper);
                });
            } else {
                const noCardsMsg = document.createElement('p');
                noCardsMsg.style.cssText = 'color: #e0c18e; text-align: center; margin: 50px 0;';
                noCardsMsg.textContent = stats.language === "ru" ? "У вас пока нет открытых карточек" : "You don't have any unlocked cards yet";
                galleryDiv.appendChild(noCardsMsg);
            }

            const closeBtn = document.createElement('button');
            closeBtn.textContent = stats.language === "ru" ? "Закрыть" : "Close";
            closeBtn.style.cssText = `
                position: fixed; top: 10px; right: 10px; background: #333; 
                color: #e0c18e; border: 1px solid #e0c18e; padding: 5px 15px; cursor: pointer;
            `;
            closeBtn.onclick = () => galleryDiv.remove();
            galleryDiv.appendChild(closeBtn);
            document.body.appendChild(galleryDiv);
        }

